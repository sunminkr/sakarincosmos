"""Render public content from the same JSON files used by the browser.

The generated cards contain text and source links; JavaScript adds the players.
No network calls, external HTML, or runtime API are needed to read these records.
"""
from datetime import datetime
from html import escape
import re
from urllib.parse import parse_qs, quote, urlsplit
from zoneinfo import ZoneInfo

SEOUL = ZoneInfo('Asia/Seoul')


def localize(entry, locale):
    return {**entry, **entry.get('translations', {}).get(locale, {})}


def media_source(value):
    """Allow only the public providers supported by assets/js/media.js."""
    try:
        url = urlsplit(value)
        if url.scheme != 'https' or url.username or url.password or url.port:
            return None
    except (TypeError, ValueError):
        return None
    if url.hostname == 'w.soundcloud.com' and url.path == '/player/':
        return media_source(parse_qs(url.query).get('url', [''])[0])
    parts = [part for part in url.path.split('/') if part]
    if url.hostname in ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com']:
        if len(parts) == 2 or (len(parts) == 3 and parts[1] == 'sets'):
            return 'SoundCloud', value
    if url.hostname == 'api.soundcloud.com' and len(parts) == 2 and parts[0] in ['tracks', 'playlists'] and parts[1].isdigit():
        return 'SoundCloud', 'https://w.soundcloud.com/player/?url=' + quote(value, safe='')
    video = None
    if url.hostname == 'youtu.be' and len(parts) == 1:
        video = parts[0]
    elif url.hostname in ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com']:
        if url.path == '/watch':
            video = parse_qs(url.query).get('v', [''])[0]
        elif len(parts) == 2 and parts[0] in ['embed', 'shorts', 'live']:
            video = parts[1]
    if video and re.fullmatch(r'[\w-]{11}', video, re.ASCII):
        return 'YouTube', 'https://www.youtube.com/watch?v=' + video
    if url.hostname in ['instagram.com', 'www.instagram.com'] and len(parts) == 2 and parts[0] in ['p', 'reel'] and re.fullmatch(r'[\w-]+', parts[1], re.ASCII):
        return 'Instagram', f'https://www.instagram.com/{parts[0]}/{parts[1]}/'
    return None


def published(entry):
    try:
        value = entry.get('publishedAt', '')
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return stamp.replace(tzinfo=stamp.tzinfo or SEOUL)
    except (ValueError, TypeError):
        return None


def media_entries(data, locale):
    entries = []
    for identifier, raw in data['entries'].items():
        entry = localize(raw, locale)
        source = media_source(entry.get('url', ''))
        if entry.get('enabled') is False or not source:
            continue
        entries.append({**entry, 'id': identifier, 'provider': source[0], 'source': source[1]})
    return sorted(entries, key=lambda entry: (
        -(published(entry).timestamp() if published(entry) else 0),
        entry.get('sourceOrder', 0), entry['id']))


def media_card(entry, messages, heading='h2'):
    stamp = published(entry)
    date = stamp.astimezone(SEOUL).strftime('%Y.%m.%d') if stamp else messages['media.unknownDate']
    date_attr = f' datetime="{escape(entry["publishedAt"])}"' if stamp else ''
    title = entry.get('title') or messages['media.post'].replace('{provider}', entry['provider'])
    author = f'<p class="media-card-author">@{escape(entry["author"])}</p>' if entry.get('author') else ''
    description = f'<p class="media-card-description">{escape(entry["description"])}</p>' if entry.get('description') else ''
    link = messages['media.open'].replace('{provider}', entry['provider'])
    return (f'<article class="media-card" data-media-id="{escape(entry["id"])}" data-provider="{entry["provider"].lower()}">'
            f'<div class="media-card-heading"><div class="media-card-meta"><span>{entry["provider"]}</span>'
            f'<time{date_attr}>{escape(date)}</time></div><{heading}>{escape(title)}</{heading}>{author}</div>'
            f'<div class="media-static-source"><a class="media-source" href="{escape(entry["source"])}" target="_blank" rel="noopener noreferrer">{escape(link)}</a></div>'
            f'{description}</article>')


def show_card(show, messages, today, timeline=False):
    date = escape(show['date'])
    venue, city = escape(show['venue']), escape(show['city'])
    title = escape(show.get('title') or messages['shows.titleUnknown'])
    starts = escape(show.get('startsAt') or messages['shows.timeUnknown'])
    if timeline:
        past = show['date'] < today
        status = messages['shows.archived'] if past else messages['shows.future']
        return (f'<article class="timeline-event bg-surface p-5 md:p-6{" opacity-65" if past else ""}">'
                f'<div class="timeline-date"><time datetime="{date}">{date.replace("-", ".")}</time><span>{escape(status)}</span></div>'
                f'<div><p class="font-mono text-[9px] text-muted">{city} · {escape(messages["shows.start"])} {starts}</p>'
                f'<h3 class="font-serif text-2xl mt-1">{venue}</h3><p class="text-sm text-muted mt-1">{title}</p></div></article>')
    action = (f'<a href="objects.html?show={quote(show["id"], safe="")}#concert-selector-list">{escape(messages["pickup.link"])}</a>'
              if show.get('pickup') else f'<span>{escape(messages["pickup.unknown"])}</span>')
    start_label = escape(messages['shows.start']) + ' ' if show.get('startsAt') else ''
    return (f'<article class="home-show"><time datetime="{date}">{date.replace("-", ".")}</time>'
            f'<div><h3>{venue}</h3><p>{title} · {start_label}{starts}</p><p>{city}</p></div>{action}</article>')


def region(source, name, content):
    start, end = f'<!-- prerender:{name}:start -->', f'<!-- prerender:{name}:end -->'
    result, count = re.subn(re.escape(start) + r'.*?' + re.escape(end), lambda _: start + content + end, source, flags=re.S)
    if count != 1:
        raise ValueError(f'Expected one prerender region: {name}, found {count}')
    return result


def render_content(source, page, locale, messages, catalog, media, today):
    today = today.isoformat()
    entries = media_entries(media, locale)
    shows = sorted((localize(show, locale) for show in catalog['shows']), key=lambda show: show['date'])
    upcoming = [show for show in shows if show['date'] >= today]
    if page == 'index':
        featured = next((entry for entry in entries if entry['provider'] in ['YouTube', 'SoundCloud']), None)
        recent = [entry for entry in entries if entry != featured][:3]
        source = region(source, 'home-featured', media_card(featured, messages, 'h3') if featured else f'<p class="media-empty">{escape(messages["media.noMusic"])}</p>')
        source = region(source, 'home-archive', '\n'.join(media_card(entry, messages, 'h3') for entry in recent) or f'<p class="media-empty">{escape(messages["media.noRecords"])}</p>')
        source = region(source, 'home-shows', '\n'.join(show_card(show, messages, today) for show in upcoming) or f'<p class="p-space-md">{escape(messages["shows.noUpcoming"])}</p>')
        source = region(source, 'home-show-count', f'{len(upcoming):02}')
    if page in ['transmissions', 'archive']:
        providers = ['SoundCloud', 'YouTube'] if page == 'transmissions' else ['SoundCloud', 'YouTube', 'Instagram']
        entries = [entry for entry in entries if entry['provider'] in providers]
        source = region(source, 'media-feed', '\n'.join(media_card(entry, messages) for entry in entries))
        status = messages['media.count'].replace('{count}', str(len(entries))) if entries else messages['media.none']
        source = region(source, 'feed-status', escape(status))
        source = region(source, 'count-all', f'{len(entries):02}')
        for provider in providers:
            source = region(source, 'count-' + provider.lower(), f'{sum(entry["provider"] == provider for entry in entries):02}')
    if page == 'observations':
        source = region(source, 'timeline', '\n'.join(show_card(show, messages, today, timeline=True) for show in shows) or f'<p>{escape(messages["shows.noMatch"])}</p>')
        for kind, key, count in [('all', 'shows.all', len(shows)), ('future', 'shows.future', len(upcoming)), ('past', 'shows.past', len(shows) - len(upcoming))]:
            source = region(source, 'timeline-count-' + kind, f'{escape(messages[key])} {count:02}')
    return source
