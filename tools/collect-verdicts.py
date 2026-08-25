#!/usr/bin/env python3
"""Collect builder/critic loop results from a workflow transcript into .progress/<piece>.json.

Usage: python3 tools/collect-verdicts.py <workflow-transcript-dir>
"""
import json
import os
import re
import sys
from pathlib import Path

PIECES = {
    'Hero': 'hero', 'Scroll': 'scroll', 'Listing grid': 'grid', 'Filters': 'filters',
    'Car render': 'render', 'Options panel': 'options', 'Live price': 'price',
    'Loading states': 'loading', 'Checkout form': 'checkout', 'Typography': 'type', 'Mobile': 'mobile',
}

def piece_of(transcript: Path):
    """The piece a transcript belongs to, read from the prompt that opened it."""
    with transcript.open(errors='ignore') as fh:
        for line in fh:
            m = re.search(r'(?:PIECE|THE PIECE UNDER REVIEW): ([A-Z][A-Za-z ]+?) —', line)
            if m:
                return PIECES.get(m.group(1).strip())
            if fh.tell() > 400_000:
                break
    return None

def main():
    root = Path(sys.argv[1])
    out_dir = Path('.progress')
    out_dir.mkdir(exist_ok=True)

    results = {}
    journal = root / 'journal.jsonl'
    if journal.exists():
        for line in journal.open(errors='ignore'):
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            if d.get('type') == 'result':
                results[d.get('agentId')] = d.get('result')

    state = {}
    for transcript in sorted(root.glob('agent-*.jsonl'), key=lambda p: p.stat().st_mtime):
        agent_id = transcript.stem.replace('agent-', '')
        piece = piece_of(transcript)
        if not piece:
            continue
        entry = state.setdefault(piece, {'id': piece, 'rounds': 0, 'status': 'building', 'verdict': '', 'gap': ''})
        result = results.get(agent_id)
        if isinstance(result, dict):          # a critic verdict
            entry['rounds'] += 1
            won = result.get('pick') == 'CANDIDATE' and result.get('confidence') != 'low'
            entry['status'] = 'won' if won else 'revising'
            entry['verdict'] = f"{result.get('pick')} ({result.get('confidence')})"
            entry['gap'] = '' if won else (result.get('biggest_gap') or '')
            entry['scores'] = result.get('scores')
        elif result is None:                  # still running
            entry['status'] = 'reviewing' if entry['rounds'] else 'building'

    for piece, entry in state.items():
        (out_dir / f'{piece}.json').write_text(json.dumps(entry, indent=2))
    print(f"{len(state)} piece(s): " + ', '.join(f"{p}={e['status']}/{e['rounds']}" for p, e in sorted(state.items())))

if __name__ == '__main__':
    main()
