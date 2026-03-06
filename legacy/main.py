import os
import sqlite3
from datetime import datetime
from functools import wraps

from flask import Flask, flash, g, redirect, render_template, request, session, url_for

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "devops_social.db")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "devops-social-local-secret")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_error):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            bio TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS follows (
            follower_id INTEGER NOT NULL,
            followed_id INTEGER NOT NULL,
            PRIMARY KEY (follower_id, followed_id),
            FOREIGN KEY (follower_id) REFERENCES users(id),
            FOREIGN KEY (followed_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS likes (
            user_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, post_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (post_id) REFERENCES posts(id)
        );
        """
    )
    db.commit()
    db.close()


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    db = get_db()
    return db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def timeline_for(user_id):
    db = get_db()
    posts = db.execute(
        """
        SELECT
            p.id,
            p.body,
            p.created_at,
            u.id AS author_id,
            u.username,
            (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
            EXISTS(
                SELECT 1
                FROM likes l2
                WHERE l2.post_id = p.id AND l2.user_id = ?
            ) AS liked_by_me
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE
            p.user_id = ?
            OR p.user_id IN (
                SELECT followed_id FROM follows WHERE follower_id = ?
            )
        ORDER BY p.created_at DESC
        """,
        (user_id, user_id, user_id),
    ).fetchall()
    return posts


def suggested_accounts(user_id):
    db = get_db()
    return db.execute(
        """
        SELECT id, username, bio
        FROM users
        WHERE id != ?
          AND id NOT IN (
              SELECT followed_id FROM follows WHERE follower_id = ?
          )
        ORDER BY created_at DESC
        LIMIT 5
        """,
        (user_id, user_id),
    ).fetchall()


@app.route("/")
def index():
    if not session.get("user_id"):
        return redirect(url_for("login"))

    user = current_user()
    db = get_db()

    stats = db.execute(
        """
        SELECT
            (SELECT COUNT(*) FROM follows WHERE followed_id = ?) AS followers,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following,
            (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS posts
        """,
        (user["id"], user["id"], user["id"]),
    ).fetchone()

    return render_template(
        "feed.html",
        user=user,
        posts=timeline_for(user["id"]),
        suggestions=suggested_accounts(user["id"]),
        stats=stats,
    )


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "").strip()

        if len(username) < 3 or len(password) < 4:
            flash("Username must be 3+ chars and password 4+ chars.")
            return render_template("auth.html", mode="register")

        db = get_db()
        try:
            db.execute(
                "INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)",
                (username, password, datetime.utcnow().isoformat()),
            )
            db.commit()
            flash("Account created. Log in now.")
            return redirect(url_for("login"))
        except sqlite3.IntegrityError:
            flash("Username already exists.")

    return render_template("auth.html", mode="register")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "").strip()

        db = get_db()
        user = db.execute(
            "SELECT * FROM users WHERE username = ? AND password = ?",
            (username, password),
        ).fetchone()

        if user:
            session.clear()
            session["user_id"] = user["id"]
            return redirect(url_for("index"))

        flash("Invalid credentials.")

    return render_template("auth.html", mode="login")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/post", methods=["POST"])
@login_required
def create_post():
    body = request.form.get("body", "").strip()
    if not body:
        flash("Post cannot be empty.")
        return redirect(url_for("index"))

    if len(body) > 280:
        flash("Post must be 280 characters or less.")
        return redirect(url_for("index"))

    db = get_db()
    db.execute(
        "INSERT INTO posts (user_id, body, created_at) VALUES (?, ?, ?)",
        (session["user_id"], body, datetime.utcnow().isoformat()),
    )
    db.commit()
    return redirect(url_for("index"))


@app.route("/like/<int:post_id>", methods=["POST"])
@login_required
def toggle_like(post_id):
    db = get_db()
    me = session["user_id"]
    existing = db.execute(
        "SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?", (me, post_id)
    ).fetchone()

    if existing:
        db.execute("DELETE FROM likes WHERE user_id = ? AND post_id = ?", (me, post_id))
    else:
        db.execute("INSERT INTO likes (user_id, post_id) VALUES (?, ?)", (me, post_id))

    db.commit()
    return redirect(url_for("index"))


@app.route("/follow/<int:user_id>", methods=["POST"])
@login_required
def follow(user_id):
    me = session["user_id"]
    if me == user_id:
        return redirect(url_for("index"))

    db = get_db()
    db.execute(
        "INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)",
        (me, user_id),
    )
    db.commit()
    return redirect(url_for("index"))


@app.route("/profile/<username>")
@login_required
def profile(username):
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if not user:
        flash("User not found.")
        return redirect(url_for("index"))

    posts = db.execute(
        """
        SELECT
            p.id,
            p.body,
            p.created_at,
            u.id AS author_id,
            u.username,
            (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
            EXISTS(
                SELECT 1 FROM likes l2
                WHERE l2.post_id = p.id AND l2.user_id = ?
            ) AS liked_by_me
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
        """,
        (session["user_id"], user["id"]),
    ).fetchall()

    stats = db.execute(
        """
        SELECT
            (SELECT COUNT(*) FROM follows WHERE followed_id = ?) AS followers,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following,
            (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS posts
        """,
        (user["id"], user["id"], user["id"]),
    ).fetchone()

    i_follow = db.execute(
        "SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?",
        (session["user_id"], user["id"]),
    ).fetchone()

    return render_template(
        "profile.html",
        profile=user,
        posts=posts,
        stats=stats,
        i_follow=bool(i_follow),
        me=current_user(),
    )


@app.template_filter("pretty_time")
def pretty_time(iso_str):
    try:
        dt = datetime.fromisoformat(iso_str)
    except ValueError:
        return iso_str

    seconds = int((datetime.utcnow() - dt).total_seconds())
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m"
    if seconds < 86400:
        return f"{seconds // 3600}h"
    return dt.strftime("%b %d")


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
