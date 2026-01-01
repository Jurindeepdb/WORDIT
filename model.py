from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)

    # stats
    total_solved = db.Column(db.Integer, default=0)
    solved_1 = db.Column(db.Integer, default=0)
    solved_2 = db.Column(db.Integer, default=0)
    solved_3 = db.Column(db.Integer, default=0)
    solved_4 = db.Column(db.Integer, default=0)
    solved_5 = db.Column(db.Integer, default=0)

    # current streak
    streak = db.Column(db.Integer, default=0)

    def record_result(self, guesses, won: bool):
        """Update user's stats after a finished game."""
        if won:
            self.total_solved = (self.total_solved or 0) + 1
            if guesses == 1:
                self.solved_1 = (self.solved_1 or 0) + 1
            elif guesses == 2:
                self.solved_2 = (self.solved_2 or 0) + 1
            elif guesses == 3:
                self.solved_3 = (self.solved_3 or 0) + 1
            elif guesses == 4:
                self.solved_4 = (self.solved_4 or 0) + 1
            elif guesses == 5:
                self.solved_5 = (self.solved_5 or 0) + 1

            # increment streak
            self.streak = (self.streak or 0) + 1
        else:
            # reset streak
            self.streak = 0

    def as_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "total_solved": self.total_solved or 0,
            "solved_1": self.solved_1 or 0,
            "solved_2": self.solved_2 or 0,
            "solved_3": self.solved_3 or 0,
            "solved_4": self.solved_4 or 0,
            "solved_5": self.solved_5 or 0,
            "streak": self.streak or 0
        }
