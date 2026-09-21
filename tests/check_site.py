"""Check static documents and local references without third-party packages."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = ['index', 'transmissions', 'observations', 'archive', 'objects', 'cart']


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.nodes = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.nodes.append((tag, dict(attrs)))


class SiteChecks(unittest.TestCase):
    def test_documents_and_local_targets(self):
        documents = [(locale, ROOT / directory / f'{page}.html')
                     for locale, directory in [('ko', ''), ('en', 'en'), ('ja', 'jp')] for page in PAGES]
        for locale, path in documents:
            page = str(path.relative_to(ROOT))
            with self.subTest(page=page):
                nodes = Document(path.read_text()).nodes
                ids = [attrs['id'] for _, attrs in nodes if 'id' in attrs]
                self.assertEqual(len(ids), len(set(ids)), 'Duplicate element IDs')
                self.assertEqual(sum(tag == 'h1' for tag, _ in nodes), 1)
                self.assertEqual(next(attrs['lang'] for tag, attrs in nodes if tag == 'html'), locale)
                self.assertTrue(any('data-site-header' in attrs for _, attrs in nodes))
                scripts = [attrs['src'].removeprefix('../') for tag, attrs in nodes if tag == 'script']
                self.assertLess(scripts.index('assets/js/i18n.js'), scripts.index('assets/js/site.js'))
                self.assertLess(scripts.index('assets/js/site.js'), scripts.index('assets/js/cart-store.js'))
                for tag, attrs in nodes:
                    if tag == 'img':
                        self.assertIn('alt', attrs)
                    for attribute in ('src', 'href'):
                        value = attrs.get(attribute, '')
                        target = urlsplit(value)
                        if not value or target.scheme or target.netloc:
                            continue
                        resolved = path.parent / unquote(target.path) if target.path else path
                        self.assertTrue(resolved.is_file(), f'{page}: missing {value}')
                        if target.fragment and resolved.suffix == '.html':
                            target_ids = [a.get('id') for _, a in Document(resolved.read_text()).nodes]
                            self.assertIn(target.fragment, target_ids, f'{page}: missing anchor {value}')

    def test_generated_translations(self):
        result = subprocess.run(['python3', str(ROOT / 'scripts/build_locales.py'), '--check'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_javascript_syntax(self):
        for path in [*ROOT.glob('assets/js/**/*.js'), *ROOT.glob('locales/*.js')]:
            with self.subTest(script=path.relative_to(ROOT)):
                result = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_old_source_paths_removed(self):
        self.assertFalse(list(ROOT.glob('sakarin_cosmos_*')))
        self.assertFalse(list(ROOT.glob('**/code.html')))
        for path in [*ROOT.glob('*.html'), *ROOT.glob('assets/js/**/*.js')]:
            self.assertNotIn('/code.html', path.read_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)
