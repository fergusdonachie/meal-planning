"""Package the browser companion and installation guide for the private web app."""
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
source = root / 'extension'
destination = root / 'app/public/downloads'
destination.mkdir(parents=True, exist_ok=True)
files = ['manifest.json', 'background.js', 'bridge.js', 'model.js', 'product-reader.js',
         'panel.html', 'panel.css', 'panel.js', 'batch.js', 'README.md']
manifest = json.loads((source / 'manifest.json').read_text())
assert manifest['manifest_version'] == 3
assert set(manifest['permissions']) == {'storage', 'scripting', 'sidePanel'}
assert set(manifest['host_permissions']) == {'https://groceries.morrisons.com/*', 'https://fd-meal-planner.vercel.app/*'}
with ZipFile(destination / 'weekly-table-morrisons.zip', 'w', compression=ZIP_DEFLATED) as archive:
    for filename in files:
        info = ZipInfo('weekly-table-morrisons/' + filename, date_time=(2026, 10, 12, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, (source / filename).read_bytes())
(destination / 'morrisons-extension-setup.txt').write_text((source / 'README.md').read_text())
print('Packaged browser companion and setup guide in app/public/downloads')
