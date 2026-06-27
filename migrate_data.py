"""
Migrate data from old Supabase project to new one.
"""
import sys
import psycopg2
import psycopg2.extras
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

OLD_DB = "postgresql://postgres.kkutlhlhasecpilgehcn:PYd4UwVYE0MTBO4m@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
NEW_DB = "postgresql://postgres.madfdwulvoxvrcgerthm:R-XBz!2%254pn5HNf@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"

TABLES_IN_ORDER = ["EmailAccount", "Campaign", "Lead", "EmailEvent", "ApiUsage"]

def migrate():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Connecting to OLD database...")
    try:
        old_conn = psycopg2.connect(OLD_DB)
        old_cur = old_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        print("  OK - Connected to OLD database")
    except Exception as e:
        print(f"  FAIL - {e}")
        return

    print(f"[{datetime.now().strftime('%H:%M:%S')}] Connecting to NEW database...")
    try:
        new_conn = psycopg2.connect(NEW_DB)
        new_cur = new_conn.cursor()
        print("  OK - Connected to NEW database")
    except Exception as e:
        print(f"  FAIL - {e}")
        old_conn.close()
        return

    for table in TABLES_IN_ORDER:
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Migrating: {table}")
        try:
            old_cur.execute(f'SELECT * FROM "{table}"')
            rows = old_cur.fetchall()
            print(f"  Found {len(rows)} rows")

            if not rows:
                print("  Skipping (empty)")
                continue

            cols = list(rows[0].keys())
            col_str = ', '.join(f'"{c}"' for c in cols)
            placeholders = ', '.join(['%s'] * len(cols))

            inserted = skipped = 0
            for row in rows:
                values = [row[c] for c in cols]
                try:
                    new_cur.execute(
                        f'INSERT INTO "{table}" ({col_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING',
                        values
                    )
                    if new_cur.rowcount > 0:
                        inserted += 1
                    else:
                        skipped += 1
                except Exception as e:
                    print(f"    Row error: {e}")
                    new_conn.rollback()

            new_conn.commit()
            print(f"  DONE - Inserted: {inserted}, Skipped: {skipped}")

        except Exception as e:
            print(f"  ERROR: {e}")
            new_conn.rollback()

    old_conn.close()
    new_conn.close()
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Migration complete!")

if __name__ == "__main__":
    migrate()
