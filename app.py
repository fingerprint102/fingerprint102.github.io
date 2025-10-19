# Import required libraries
import random
import json
import os

# Create a dictionary to store questions, options, and answers
quiz_questions = {
    "What is the capital of France?": {
        "A": "Paris",
        "B": "London",
        "C": "Berlin",
        "D": "Rome",
        "answer": "A"
    },
    "Who painted the Mona Lisa?": {
        "A": "Leonardo da Vinci",
        "B": "Michelangelo",
        "C": "Raphael",
        "D": "Caravaggio",
        "answer": "A"
    },
    "What is the largest planet in our solar system?": {
        "A": "Earth",
        "B": "Saturn",
        "C": "Jupiter",
        "D": "Uranus",
        "answer": "C"
    }
}

# Function to add a new question to the quiz
def add_question():
    question = input("Enter the question: ")
    options = {}
    for i in ["A", "B", "C", "D"]:
        options[i] = input(f"Enter option {i}: ")
    answer = input("Enter the correct answer (A/B/C/D): ")
    quiz_questions[question] = options
    quiz_questions[question]["answer"] = answer
    save_questions()

# Function to save questions to a JSON file
def save_questions():
    with open("questions.json", "w") as f:
        json.dump(quiz_questions, f)

# Function to load questions from a JSON file
def load_questions():
    global quiz_questions
    if os.path.exists("questions.json"):
        with open("questions.json", "r") as f:
            quiz_questions = json.load(f)

# Function to play the quiz
def play_quiz():
    score = 0
    questions = list(quiz_questions.keys())
    random.shuffle(questions)
    for question in questions:
        print(question)
        options = quiz_questions[question]
        for option, value in options.items():
            if option != "answer":
                print(f"{option}: {value}")
        answer = input("Enter your answer (A/B/C/D): ")
        if answer.upper() == options["answer"]:
            print("Correct!\n")
            score += 1
        else:
            print(f"Incorrect. The correct answer is {options['answer']}.\n")
    print(f"Quiz finished. Your score is {score}/{len(questions)}")

# Main function
def main():
    load_questions()
    while True:
        print("1. Play Quiz")
        print("2. Add Question")
        print("3. Exit")
        choice = input("Enter your choice: ")
        if choice == "1":
            play_quiz()
        elif choice == "2":
            add_question()
        elif choice == "3":
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()
