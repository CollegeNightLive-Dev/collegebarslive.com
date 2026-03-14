#!/usr/bin/env python3
"""
Initialize Firestore for the Sly alert system:
- Adds active_alerts: [] to every bar document that doesn't already have it.

Run from project root with a service account key that has Firestore edit access:
  set GOOGLE_APPLICATION_CREDENTIALS=path\to\serviceAccountKey.json
  python scripts/init_sly_alert_fields.py

Or:
  python scripts/init_sly_alert_fields.py path/to/serviceAccountKey.json

Requires: pip install google-cloud-firestore
"""

import argparse
import os
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description="Add active_alerts field to all bar docs for Sly alerts.")
    parser.add_argument(
        "credentials",
        nargs="?",
        default=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"),
        help="Path to Firebase/Google service account JSON, or set GOOGLE_APPLICATION_CREDENTIALS",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only list what would be updated, do not write.",
    )
    args = parser.parse_args()

    if not args.credentials or not os.path.isfile(args.credentials):
        print(
            "Error: Need a service account JSON file.\n"
            "  Get it from: Firebase Console → Project Settings → Service accounts → Generate new private key\n"
            "  Then run: set GOOGLE_APPLICATION_CREDENTIALS=path\\to\\key.json\n"
            "  Or: python scripts/init_sly_alert_fields.py path\\to\\key.json",
            file=sys.stderr,
        )
        sys.exit(1)

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = args.credentials

    try:
        from google.cloud import firestore
    except ImportError:
        print(
            "Error: Install the Firestore client: pip install google-cloud-firestore",
            file=sys.stderr,
        )
        sys.exit(1)

    db = firestore.Client()
    universities_ref = db.collection("universities")
    updated = 0
    skipped = 0
    errors = []

    for uni_doc in universities_ref.stream():
        uni_id = uni_doc.id
        bars_ref = universities_ref.document(uni_id).collection("bars")
        for bar_doc in bars_ref.stream():
            bar_id = bar_doc.id
            data = bar_doc.to_dict()
            if "active_alerts" in data:
                skipped += 1
                continue
            if args.dry_run:
                print(f"Would add active_alerts to universities/{uni_id}/bars/{bar_id}")
                updated += 1
                continue
            try:
                bar_doc.reference.update({"active_alerts": []})
                print(f"Updated universities/{uni_id}/bars/{bar_id}")
                updated += 1
            except Exception as e:
                errors.append((uni_id, bar_id, str(e)))

    if errors:
        print("\nErrors:", file=sys.stderr)
        for uni_id, bar_id, msg in errors:
            print(f"  universities/{uni_id}/bars/{bar_id}: {msg}", file=sys.stderr)
        sys.exit(1)

    print(f"\nDone. Updated: {updated}, already had active_alerts: {skipped}")


if __name__ == "__main__":
    main()
