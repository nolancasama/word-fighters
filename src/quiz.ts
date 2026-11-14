// Teacher testing mode: a four-question word -> picture recognition check,
// kept completely separate from the battle. No feedback on right/wrong (it is a measure).

import { ANIMALS, type Animal } from "./config";
import { animalUrl } from "./art";
import { sfx } from "./audio";

export interface QuizResult {
  kind: "pre" | "post";
  score: number;
  answers: { word: Animal; picked: Animal }[];
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function runQuiz(screen: HTMLElement, kind: "pre" | "post", onDone: (r: QuizResult) => void): void {
  const words = shuffle([...ANIMALS]);
  const answers: QuizResult["answers"] = [];
  screen.hidden = false;
  const label = kind === "pre" ? "まえ テスト" : "あと テスト";

  const ask = (i: number) => {
    if (i >= words.length) {
      const score = answers.filter((a) => a.word === a.picked).length;
      screen.innerHTML = `<div class="sheet"><h2>${label}</h2><h1>おわり！</h1>
        <button class="big" data-next>OK</button></div>`;
      screen.querySelector("[data-next]")!.addEventListener("click", () => onDone({ kind, score, answers }));
      return;
    }
    const word = words[i];
    const pics = shuffle([...ANIMALS]);
    screen.innerHTML = `<div class="sheet" data-quiz="${kind}">
      <div class="teacher-line">${label} ${i + 1} / ${words.length}</div>
      <div class="quiz-word" data-word="${word}">${word.toUpperCase()}</div>
      <div class="quiz-pics">${pics.map((p) => `<button data-pick="${p}" aria-label="picture"><img src="${animalUrl(p)}" alt=""></button>`).join("")}</div>
    </div>`;
    screen.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((b) =>
      b.addEventListener("click", () => {
        sfx.tap();
        answers.push({ word, picked: b.dataset.pick as Animal });
        ask(i + 1);
      })
    );
  };
  ask(0);
}
