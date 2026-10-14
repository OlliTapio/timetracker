import argparse
import datetime as dt
import time

from . import collector, config, review, summarize


def main() -> None:
    ap = argparse.ArgumentParser(prog="timetracker")
    ap.add_argument("--config", default="config.toml")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("collect", help="sample the screen every few seconds (run on the work PC)")
    s = sub.add_parser("summarize", help="write entries for finished blocks")
    s.add_argument("--loop", action="store_true", help="keep running, once a minute")
    today = dt.date.today().isoformat()
    r = sub.add_parser("review", help="show a day's entries")
    r.add_argument("day", nargs="?", default=today)
    l = sub.add_parser("label", help="correct one block, e.g. label 09:15 Sono 'PR review'")
    l.add_argument("time")
    l.add_argument("project")
    l.add_argument("activity", nargs="?", default="")
    l.add_argument("--day", default=today)
    a = sub.add_parser("accept", help="mark the rest of a day's entries as correct")
    a.add_argument("day", nargs="?", default=today)
    sub.add_parser("eval", help="accuracy of entries against your labels")
    args = ap.parse_args()
    cfg = config.load(args.config)

    if args.cmd == "collect":
        collector.run(cfg)
    elif args.cmd == "summarize":
        while True:
            print(f"wrote {summarize.summarize_pending(cfg)} entries")
            if not args.loop:
                break
            time.sleep(60)
    elif args.cmd == "review":
        print("\n".join(review.show(cfg, args.day)) or "no entries")
    elif args.cmd == "label":
        review.label(cfg, args.day, args.time, args.project, args.activity)
    elif args.cmd == "accept":
        print(f"accepted {review.accept(cfg, args.day)} entries")
    elif args.cmd == "eval":
        print(review.evaluate(cfg))


if __name__ == "__main__":
    main()
