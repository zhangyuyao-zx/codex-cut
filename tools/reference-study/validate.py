"""Validate reference-study evidence structure; never infer visual/audio approval."""
import argparse
import json
import math
from pathlib import Path
from urllib.parse import urlsplit, unquote

GROUPS = ('scenes', 'sentences', 'elements', 'children', 'globals', 'events', 'transitions')


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def local_resource(base, value):
    """Resources must remain in the portable study directory, including symlinks."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError('empty resource path')
    parsed = urlsplit(value)
    decoded = unquote(parsed.path)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment or Path(decoded).is_absolute():
        raise ValueError('resource must be a relative local path')
    root = Path(base).resolve()
    target = (root / decoded).resolve()
    if not target.is_relative_to(root):
        raise ValueError('resource escapes study directory')
    return target


def validate(data, base, check_files=True):
    errors, warnings, resources = [], [], set()

    def check(ok, message):
        if not ok:
            errors.append(message)

    def result():
        return {'passed': not errors, 'errors': errors, 'warnings': warnings,
                'scope': 'Structure, ranges and evidence references only; not visual/audio or user acceptance.'}

    if not isinstance(data, dict):
        errors.append('Study must be an object')
        return result()
    check(type(data.get('schemaVersion')) is int and data['schemaVersion'] == 1, 'Expected schemaVersion 1')
    for key in ('source', 'status'):
        check(isinstance(data.get(key), dict), f'{key} must be an object')
    for key in GROUPS:
        check(isinstance(data.get(key), list) and all(isinstance(x, dict) for x in data.get(key, []) or []),
              f'{key} must be an array of records')
    for key in ('refinedMotion', 'nativeWindows'):
        check(isinstance(data.get(key, []), list) and all(isinstance(x, dict) for x in data.get(key, []) or []),
              f'{key} must be an array of records')
    if errors:
        return result()
    source = data['source']
    check(isinstance(source.get('localPlayback', ''), str), 'localPlayback must be a relative path string or empty')
    duration, fps, count = source.get('videoDuration'), source.get('fps'), source.get('frameCount')
    check(number(duration) and duration > 0, 'Source duration must be positive')
    check(number(fps) and fps > 0, 'Source fps must be positive')
    check(isinstance(count, int) and not isinstance(count, bool) and count > 0, 'Source frameCount must be positive integer')
    check(source.get('timebase', 'cfr') == 'cfr', 'VFR requires original PTS mapping; this viewer currently supports CFR only')
    if errors:
        return result()
    check(abs(count / fps - duration) <= 1 / fps + .001, 'Frame count and duration disagree')
    ids = set()
    for group in GROUPS + ('refinedMotion',):
        for record in data.get(group, []):
            ident = record.get('id')
            if not isinstance(ident, str) or not ident.strip():
                errors.append(f'{group}: missing string id')
            elif ident in ids:
                errors.append(f'Duplicate id: {ident}')
            else:
                ids.add(ident)
    if errors:
        return result()
    scenes = {x['id']: x for x in data['scenes']}
    elements = {x['id']: x for x in data['elements']}
    objects = {**elements, **{x['id']: x for x in data['globals']}}

    def span(record):
        start, end = record.get('start'), record.get('end')
        valid = number(start) and number(end) and 0 <= start < end <= duration + .001
        check(valid, f"Invalid time range: {record['id']}")
        return valid

    valid_scenes = [x for x in data['scenes'] if span(x)]
    check(bool(valid_scenes), 'At least one visual scene is required')
    cursor = 0
    for scene in sorted(valid_scenes, key=lambda x: x['start']):
        check(abs(scene['start'] - cursor) < .001, f"Visual gap/overlap before {scene['id']}")
        cursor = scene['end']
    check(abs(cursor - duration) < .001, 'Visual timeline does not cover the ending')

    def refs(record, key, targets):
        values = record.get(key, [])
        check(isinstance(values, list), f"{record['id']}: {key} must be array")
        if isinstance(values, list):
            for value in values:
                check(isinstance(value, str) and value in targets, f"{record['id']}: unknown {key} reference")

    sentence_spans = []
    for sentence in data['sentences']:
        if span(sentence):
            sentence_spans.append((sentence['start'], sentence['end']))
        refs(sentence, 'segments', scenes)
        refs(sentence, 'elementIds', objects)
    for record in data['elements'] + data['events']:
        scene_id = record.get('sceneId')
        valid_scene = isinstance(scene_id, str) and scene_id in scenes
        check(valid_scene, f"Unknown scene: {record['id']}")
        if valid_scene and number(record.get('time')) and scenes[scene_id] in valid_scenes:
            scene = scenes[scene_id]
            check(scene['start'] <= record['time'] <= scene['end'], f"Anchor outside owning scene: {record['id']}")
    for element in data['elements'] + data['globals']:
        check(bool(element.get('analysis')), f"Missing element explanation: {element['id']}")
        frame, time = element.get('frame'), element.get('time')
        valid_frame = isinstance(frame, int) and not isinstance(frame, bool) and 0 <= frame < count
        check(valid_frame, f"Invalid frame: {element['id']}")
        check(number(time) and 0 <= time < duration, f"Invalid anchor time: {element['id']}")
        if valid_frame and number(time):
            check(abs(time - frame / fps) < .5 / fps + .001, f"Frame/time mismatch: {element['id']}")
        if 'bbox' in element:
            box = element['bbox']
            valid = isinstance(box, list) and len(box) == 4 and all(number(v) for v in box)
            check(valid, f"Invalid bounding box: {element['id']}")
            if valid:
                check(box[0] >= 0 and box[1] >= 0 and box[2] > 0 and box[3] > 0 and
                      box[0] + box[2] <= 100.1 and box[1] + box[3] <= 100.1,
                      f"Bounding box out of range: {element['id']}")
    for child in data['children']:
        parent = child.get('parentId')
        check(isinstance(parent, str) and parent in objects, f"Unknown parent: {child['id']}")
        check(isinstance(child.get('name'), str) and bool(child['name'].strip()), f"Missing child name: {child['id']}")
        if isinstance(parent, str) and parent in elements and child.get('sceneId'):
            check(child['sceneId'] == elements[parent]['sceneId'], f"Child/parent scene mismatch: {child['id']}")
    for event in data['events']:
        check(number(event.get('time')) and 0 <= event['time'] <= duration, f"Event out of range: {event['id']}")
        refs(event, 'elementIds', objects)
    for transition in data['transitions']:
        span(transition)
        for key in ('fromSceneId', 'toSceneId'):
            check(isinstance(transition.get(key), str) and transition[key] in scenes,
                  f"Unknown transition scene: {transition['id']}")
    for motion in data.get('refinedMotion', []):
        valid = span(motion)
        scene_id = motion.get('sceneId')
        check(isinstance(scene_id, str) and scene_id in scenes, f"Unknown motion scene: {motion['id']}")
        if valid and isinstance(scene_id, str) and scene_id in scenes and scenes[scene_id] in valid_scenes:
            scene = scenes[scene_id]
            check(scene['start'] <= motion['start'] < motion['end'] <= scene['end'],
                  f"Motion outside owning scene: {motion['id']}")
    for index, window in enumerate(data.get('nativeWindows', [])):
        span({**window, 'id': f'native-window-{index}'})

    def walk(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key in ('image', 'strip', 'localPlayback'):
                    check(isinstance(item, str), f'{key} must be a relative path string')
                    if isinstance(item, str) and item:
                        resources.add(item)
                elif key in ('evidenceSheets', 'sheets'):
                    check(isinstance(item, list), f'{key} must be an array of paths')
                    for resource in item if isinstance(item, list) else []:
                        if isinstance(resource, str):
                            resources.add(resource)
                        else:
                            errors.append('Evidence path must be a string')
                else:
                    walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
    walk(data)
    for resource in resources:
        try:
            target = local_resource(base, resource)
            if check_files:
                check(target.is_file(), f'Missing evidence: {resource}')
        except ValueError as error:
            errors.append(f'Invalid evidence path: {resource} ({error})')
    if not source.get('localPlayback'):
        warnings.append('No video playback bound; frame/data browsing only')
    if data['status'].get('normalSpeedAudiovisual') is not True:
        warnings.append('Normal-speed audiovisual review is not recorded as complete')
    if not isinstance(data.get('audio'), dict) or data['audio'].get('subjectiveVerified') is not True:
        warnings.append('Audio listening is not recorded as complete')
    gaps, cursor = [], 0
    for start, end in sorted(sentence_spans):
        if start > cursor + .001:
            gaps.append([round(cursor, 3), round(start, 3)])
        cursor = max(cursor, end)
    if cursor < duration:
        gaps.append([cursor, duration])
    return {**result(), 'counts': {k: len(data[k]) for k in GROUPS}, 'resourceCount': len(resources),
            'sentenceTimingGaps': gaps, 'visualTimelineCoverage': 'continuous' if not errors else 'see errors'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('data', type=Path)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    try:
        report = validate(json.loads(args.data.read_text(encoding='utf-8')), args.data.parent)
    except (ValueError, OSError) as error:
        report = {'passed': False, 'errors': [str(error)]}
    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        args.out.write_text(output + '\n', encoding='utf-8')
    print(output)
    raise SystemExit(0 if report['passed'] else 1)
