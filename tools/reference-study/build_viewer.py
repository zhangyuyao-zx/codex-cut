"""Build a self-contained study viewer next to the study data and evidence."""
import argparse
import json
from pathlib import Path
from validate import validate


def build(data_file, output=None, force=False):
    data_file = Path(data_file).resolve()
    output = Path(output).resolve() if output else data_file.with_name('study.html')
    if output.parent != data_file.parent or output == data_file:
        raise ValueError('Viewer must be a separate file beside the study JSON so evidence paths stay valid')
    if output.exists() and not force:
        raise ValueError('Output exists; choose a new name or explicitly use --force')
    data = json.loads(data_file.read_text(encoding='utf-8'))
    report = validate(data, data_file.parent)
    if not report['passed']:
        raise ValueError('\n'.join(report['errors']))
    # User/source strings are data, never HTML or executable script.
    encoded = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    encoded = encoded.replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    template = Path(__file__).with_name('viewer.html').read_text(encoding='utf-8')
    output.write_text(template.replace('__STUDY_DATA__', encoded), encoding='utf-8')
    return {'output': str(output), 'warnings': report['warnings'], 'userAccepted': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('data', type=Path)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(build(args.data, args.out, args.force), ensure_ascii=False, indent=2))
    except (ValueError, OSError) as error:
        parser.exit(1, str(error) + '\n')
