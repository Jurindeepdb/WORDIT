from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from model import db, User
import random
import os

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL",
    "sqlite:///local.db"   # fallback for local dev
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.secret_key = os.urandom(24)

db.init_app(app)

# Load words.txt (generate this from your CSV earlier)
with app.app_context():
    db.create_all()

WORDS = []
WORDS_FILE = "words.txt"  # ensure you've converted 5_letters.csv -> words.txt (one word per line)
if os.path.exists(WORDS_FILE):
    with open(WORDS_FILE, "r") as f:
        WORDS = [w.strip().lower() for w in f if len(w.strip()) == 5]
else:
    # fallback to minimal list if file is missing
    WORDS = ["apple", "crane", "brave", "drink", "eagle"]

# In-memory per-user active games: { user_id: {answer, attempts, guesses:[{guess, result}] } }
# Note: ephemeral (not persistent across server restarts). OK for prototype.
GAME_SESSIONS = {}

def evaluate_guess(guess: str, answer: str):
    """Return a list of color strings for each letter: 'green', 'yellow', 'gray'."""
    guess = guess.lower()
    answer = answer.lower()
    result = ["gray"] * 5
    used = [False] * 5

    # pass 1: greens
    for i in range(5):
        if guess[i] == answer[i]:
            result[i] = "green"
            used[i] = True

    # pass 2: yellows
    for i in range(5):
        if result[i] == "green":
            continue
        for j in range(5):
            if not used[j] and guess[i] == answer[j]:
                result[i] = "yellow"
                used[j] = True
                break

    return result

@app.route("/")
def index():
    return render_template("index.html")

# --- user endpoints --- (replace existing /create_user)
@app.route("/create_user", methods=["POST"])
def create_user():
    data = request.json or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400

    # check if user already exists -> fail (create-only)
    existing = User.query.filter_by(name=name).first()
    if existing:
        return jsonify({"error": "Account already exists with that name"}), 400

    user = User(name=name)
    db.session.add(user)
    db.session.commit()
    return jsonify({"user": user.as_dict()}), 201


@app.route("/login", methods=["POST"])
def login_user():
    data = request.json or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400

    user = User.query.filter_by(name=name).first()
    if not user:
        # exact message you requested for this case
        return jsonify({"error": "No account exists with that name"}), 404

    return jsonify({"user": user.as_dict()}), 200


@app.route("/start", methods=["POST"])
def start_game():
    data = request.json or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "invalid user_id"}), 400

    answer = random.choice(WORDS)
    # initialize session
    GAME_SESSIONS[user_id] = {
        "answer": answer,
        "attempts": 0,
        "guesses": []
    }
    return jsonify({"status": "started"})

@app.route("/check", methods=["POST"])
def check_word():
    data = request.json or {}
    user_id = data.get("user_id")
    guess = (data.get("guess") or "").strip().lower()

    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "invalid user"}), 400

    session = GAME_SESSIONS.get(user_id)
    if not session:
        return jsonify({"error": "no active game for user; call /start"}), 400

    if len(guess) != 5 or not guess.isalpha():
        return jsonify({"error": "Guess must be exactly 5 letters"}), 400

    # dictionary validation
    if guess not in WORDS:
        return jsonify({"error": "not a word in the dictionary"}), 400

    answer = session["answer"]
    result = evaluate_guess(guess, answer)

    session["attempts"] += 1
    session["guesses"].append({"guess": guess, "result": result})

    won = (guess == answer)
    game_over = False
    message = ""
    stats_payload = None

    if won or session["attempts"] >= 5:
        # finalize stats
        game_over = True
        attempts_taken = session["attempts"]
        user.record_result(attempts_taken, won)
        db.session.commit()

        # prepare stats to return to frontend
        stats_payload = user.as_dict()

        if won:
            message = "Congratulations!!!"
        else:
            message = "Better luck next time <3"

        # include correct word
        correct_word = answer

        # clear session for next game
        GAME_SESSIONS.pop(user_id, None)

        return jsonify({
            "result": result,
            "game_over": True,
            "won": won,
            "message": message,
            "correct_word": correct_word,
            "stats": stats_payload
        })

    # not finished yet
    return jsonify({
        "result": result,
        "game_over": False,
        "attempts_left": 5 - session["attempts"]
    })
    
@app.route("/logout")
def logout():
    session.clear()   # wipes all session data
    return redirect(url_for("index"))

if __name__ == "__main__":
    app.run(debug=True)
