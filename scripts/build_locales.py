"""Generate localized HTML and public content from templates, dictionaries and JSON."""
import argparse
import html
import json
from pathlib import Path
import re
from datetime import date, datetime

from prerender import render_content, SEOUL

ROOT = Path(__file__).resolve().parents[1]
PAGES = ['index', 'transmissions', 'observations', 'archive', 'objects', 'cart']
LOCALES = {'ko': '', 'en': 'en', 'ja': 'jp'}


def messages(locale):
    source = (ROOT / f'locales/{locale}.js').read_text()
    return json.loads(source.split(f'window.SiteMessages.{locale} = ', 1)[1].strip().removesuffix(';'))


def render(source, page, locale, dictionary):
    prefix = '../' if LOCALES[locale] else ''
    source = re.sub(r'<link rel="alternate" hreflang="[^"]+" href="[^"]+">\n?', '', source)
    source = re.sub(r'(<html\b[^>]*\blang=")[^"]+', r'\g<1>' + locale, source)

    def text(match):
        tag, attrs, key = match.group(1, 2, 3)
        return f'<{tag}{attrs}>{html.escape(dictionary[key], quote=False)}</{tag}>'
    source = re.sub(r'<([\w-]+)([^<>]*\bdata-i18n="([^"]+)"[^<>]*)>[^<>]*</\1>', text, source)

    def attributes(match):
        tag = match.group(0)
        for hook, attribute in [('data-i18n-content', 'content'), ('data-i18n-label', 'aria-label'), ('data-i18n-placeholder', 'placeholder')]:
            key = re.search(r'\b' + hook + r'="([^"]+)"', tag)
            if key:
                value = html.escape(dictionary[key[1]], quote=True)
                tag = re.sub(r'(?<![\w-])' + attribute + r'="[^"]*"', lambda _: f'{attribute}="{value}"', tag)
        if prefix:
            tag = re.sub(r'\b(src|href)="((?:assets|locales)/[^"]+)"', lambda m: f'{m[1]}="{prefix}{m[2]}"', tag)
        return tag
    source = re.sub(r'<[\w-]+\b[^>]*>', attributes, source)
    if locale == 'ja':
        title = dictionary['band.name'] if page == 'index' else dictionary.get('nav.' + page, '受け取りカート') + ' — ' + dictionary['band.name']
        source = re.sub(r'<title>[^<]*</title>', '<title>' + html.escape(title) + '</title>', source)
    alternates = ''.join(f'<link rel="alternate" hreflang="{lang}" href="{prefix}{directory + "/" if directory else ""}{page}.html">\n' for lang, directory in LOCALES.items())
    source = source.replace('</head>', alternates + '</head>')
    return source


def build(check=False, as_of=None):
    dictionaries = {locale: messages(locale) for locale in LOCALES}
    keys = set(dictionaries['ko'])
    assert all(set(values) == keys for values in dictionaries.values()), 'Locale dictionary keys differ'
    catalog = json.loads((ROOT / 'data/catalog.json').read_text())
    media = json.loads((ROOT / 'data/media.json').read_text())
    today = as_of or datetime.now(SEOUL).date()
    stale = []
    for page in PAGES:
        source = (ROOT / f'{page}.html').read_text()
        for locale, directory in LOCALES.items():
            output = ROOT / directory / f'{page}.html'
            expected = render(source, page, locale, dictionaries[locale])
            expected = render_content(expected, page, locale, dictionaries[locale], catalog, media, today)
            if check:
                if not output.exists() or output.read_text() != expected:
                    stale.append(str(output.relative_to(ROOT)))
            else:
                output.parent.mkdir(exist_ok=True)
                output.write_text(expected)
    if stale:
        raise SystemExit('Run python3 scripts/build_locales.py: ' + ', '.join(stale))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--as-of', type=date.fromisoformat, help='Schedule date (YYYY-MM-DD); defaults to today in Seoul')
    args = parser.parse_args()
    build(args.check, args.as_of)
