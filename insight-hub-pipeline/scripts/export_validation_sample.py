import argparse
import csv
import sys

from app.db import get_connection
from app.validation_sample import export_sample_rows


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Exporte un échantillon de validation vers un CSV à annoter manuellement."
    )
    parser.add_argument("validation_run_id", type=int)
    parser.add_argument("output_csv", type=str)
    args = parser.parse_args()

    conn = get_connection()
    try:
        rows = export_sample_rows(conn, args.validation_run_id)
    finally:
        conn.close()

    if not rows:
        print(f"Aucun message trouvé pour validation_run_id={args.validation_run_id}", file=sys.stderr)
        sys.exit(1)

    with open(args.output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "text", "sentiment_ai", "sentiment_manual"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"{len(rows)} messages exportés vers {args.output_csv}")


if __name__ == "__main__":
    main()
