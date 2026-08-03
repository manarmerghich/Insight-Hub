import argparse
import csv

from app.db import get_connection
from app.validation_sample import import_annotations


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Réimporte un échantillon de validation annoté et calcule le taux d'accord."
    )
    parser.add_argument("validation_run_id", type=int)
    parser.add_argument("input_csv", type=str)
    args = parser.parse_args()

    with open(args.input_csv, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    conn = get_connection()
    try:
        result = import_annotations(conn, args.validation_run_id, rows)
    finally:
        conn.close()

    print(f"Annotations valides : {result['valid_count']}")
    if result["invalid_ids"]:
        print(f"Lignes invalides ignorées (id): {result['invalid_ids']}")
    if result["agreement_rate"] is not None:
        print(f"Taux d'accord : {result['agreement_rate']:.2%}")
    else:
        print("Taux d'accord : non calculable (aucune annotation valide)")


if __name__ == "__main__":
    main()
