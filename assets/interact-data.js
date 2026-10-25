/* Reading Future · tap-choice / sort / parent-assist content.
   Every spoken line here has a TTS clip in assets/voice/<voice>/fb/<fnv1a(text)>.mp3
   (built by tools/build_fb_voice.py). Screen keys are SCREENS[i].i. */
window.RF_IX = {
  praise: ["Yes, Miles!", "Great job, Miles!", "That's right, Miles!", "Well done!", "You got it, Miles!", "Super!"],
  hintLead: ["Hmm, let's think again.", "Good try, Miles. Have another look.", "Almost! Try once more.", "Let's look again together.", "Nice try! Think about it again."],
  explainLead: ["Here's the answer.", "Let's see the answer together.", "This is the one."],
  parentPraise: ["Great thinking, Miles!", "What a good answer, Miles!", "I love how you said that, Miles!", "Wonderful speaking, Miles!", "Brilliant idea, Miles!", "You explained that so well, Miles!"],
  sortDone: ["You sorted them all, Miles! Fantastic!", "All done! Great sorting, Miles!"],
  units: {
    unit1: {
      22: { kind: 'choice', options: ['Main idea', 'Detail'], answer: 1,
        why: "It's one little fact.", hint: "Is it about the whole story, or one little fact?",
        explain: "It's a detail. It tells one little fact about the rabbits." },
      23: { kind: 'choice', options: ['Main idea', 'Detail'], answer: 0,
        why: "It's what the whole story is about.", hint: "Does it tell about the whole story?",
        explain: "It's the main idea. The whole story is about it." },
      26: { kind: 'rows', rows: [
        { label: 'Cows know ___ it will rain.', options: ['how', 'when'], answer: 1, ask: "Cows know blank it will rain. Tap how, or when.", why: "When tells us the time.", hint: "Which word tells us the time?", explain: "When. Cows know when it will rain." },
        { label: 'They stretch their ___.', options: ['necks', 'fat'], answer: 0, ask: "They stretch their blank. Tap necks, or fat.", why: "Cows stretch their necks.", hint: "What can a cow stretch?", explain: "Necks. Cows stretch their necks." },
        { label: 'They ___ the air.', options: ['know', 'smell'], answer: 1, ask: "They blank the air. Tap know, or smell.", why: "We smell with our noses.", hint: "What do you do with your nose?", explain: "Smell. They smell the air." } ] },
      30: { kind: 'sortIntro', ref: 31 },
      31: { kind: 'sort',
        prompt: "Drag each card to the right box.",
        bins: [{ id: 'rain', label: 'It will rain', tone: 'blue' }, { id: 'winter', label: 'Long, cold winter', tone: 'gold' }],
        cards: [
          { t: 'a. Rabbits get very fat.', ill: 'rabbit', bin: 'winter', why: "Fat rabbits mean a long, cold winter.", hint: "Think about the rabbits. Do they tell us about rain or winter?" },
          { t: 'b. Smell the air.', ill: 'cow', bin: 'rain', why: "Cows and horses smell the air before rain.", hint: "Cows and horses do this. What do they know?" },
          { t: 'c. Rabbits eat a lot.', ill: 'rabbit', bin: 'winter', why: "Rabbits eat a lot before a long winter.", hint: "Rabbits get ready for something cold." },
          { t: 'd. Stretch their necks.', ill: 'horse', bin: 'rain', why: "They stretch their necks when rain is coming.", hint: "Cows and horses do this. What do they know?" } ] }
    },
    unit2: {
      10: { kind: 'choice', options: ['White clouds', 'Storm clouds'], answer: 1,
        why: "Storm clouds are dark and tall. They make rain.", hint: "Which clouds are dark and tall?",
        explain: "Storm clouds. Only storm clouds make rain." },
      11: { kind: 'choice', options: ['They are thin.', 'They make rain.'], answer: 0,
        why: "High clouds are thin and long.", hint: "Do high clouds make rain?",
        explain: "They are thin. High clouds do not make rain." },
      18: { kind: 'choice', options: ['Kinds of clouds', 'Fish from the sky'], answer: 0,
        why: "The whole reading is about kinds of clouds.", hint: "What does every part of the reading talk about?",
        explain: "Kinds of clouds. That is the main idea." },
      19: { kind: 'choice', options: ['Dark and gray', 'Thin and long'], answer: 0,
        why: "Storm clouds are dark and gray.", hint: "Storm clouds are not thin. Look again.",
        explain: "Dark and gray. Storm clouds are dark and gray." },
      20: { kind: 'choice', options: ['thin', 'white', 'every'], answer: 2,
        why: "All means every one.", hint: "All the children means every child.",
        explain: "Every. All means every one." },
      21: { kind: 'rows', rows: [
        { label: 'Not ___ clouds make rain.', options: ['all', 'some'], answer: 0, ask: "Not blank clouds make rain. Tap all, or some.", why: "Not all clouds make rain.", hint: "Every cloud? Not every cloud!", explain: "All. Not all clouds make rain." },
        { label: 'Low clouds are white and ___.', options: ['dark', 'fluffy'], answer: 1, ask: "Low clouds are white and blank. Tap dark, or fluffy.", why: "Low clouds are white and fluffy.", hint: "Low clouds look soft, like cotton.", explain: "Fluffy. Low clouds are white and fluffy." },
        { label: '___ clouds make rain!', options: ['High', 'Storm'], answer: 1, ask: "Blank clouds make rain. Tap high, or storm.", why: "Storm clouds make rain.", hint: "Which clouds are dark and tall?", explain: "Storm. Storm clouds make rain." } ] },
      25: { kind: 'sort',
        prompt: "Drag each card to its cloud.",
        bins: [{ id: 'high', label: 'High clouds', tone: 'blue' }, { id: 'low', label: 'Low clouds', tone: 'green' }, { id: 'storm', label: 'Storm clouds', tone: 'gray' }],
        cards: [
          { t: 'thin, long', bin: 'high', why: "High clouds are thin and long.", hint: "These clouds are up high in the sky." },
          { t: 'white, fluffy', bin: 'low', why: "Low clouds are white and fluffy.", hint: "These clouds look soft, like cotton." },
          { t: 'dark, gray', bin: 'storm', why: "Storm clouds are dark and gray.", hint: "These clouds bring rain." } ] }
    },
    unit3: {
      9: { kind: 'choice', options: ['Rain', 'Water'], answer: 1,
        why: "Clouds are made of water.", hint: "Rain falls from clouds. But what are clouds made of?",
        explain: "Water. Clouds are made of water." },
      10: { kind: 'choice', options: ['It can be dangerous.', 'It is warm.'], answer: 0,
        why: "Hail is balls of ice. It can be dangerous.", hint: "Hail is made of ice. Is ice warm?",
        explain: "It can be dangerous. Hail is balls of ice." },
      16: { kind: 'choice', options: ['Rain, snow, and hail', 'Fish from the sky'], answer: 0,
        why: "The reading is all about weather: rain, snow, and hail.", hint: "What does every part of the reading talk about?",
        explain: "Rain, snow, and hail. That is the main idea." },
      17: { kind: 'choice', options: ['falls', 'flies'], answer: 0,
        why: "Water falls down to the earth.", hint: "Rain comes down. Does it fly or fall?",
        explain: "Falls. The water falls down to the earth." },
      18: { kind: 'choice', options: ['It becomes hail.', 'It becomes warm.'], answer: 0,
        why: "The water gets cold and becomes hail.", hint: "The water goes up high, where it is very cold.",
        explain: "It becomes hail. Balls of ice!" },
      19: { kind: 'rows', rows: [
        { label: 'Rain ___ when warm.', options: ['happens', 'freezes'], answer: 0, ask: "Rain blank when warm. Tap happens, or freezes.", why: "Rain happens when it is warm.", hint: "Warm weather gives us rain. Which word fits?", explain: "Happens. Rain happens when warm." },
        { label: '___ happens when cold.', options: ['Rain', 'Snow'], answer: 1, ask: "Blank happens when cold. Tap rain, or snow.", why: "Snow happens when it is cold.", hint: "Which one is cold and white?", explain: "Snow. Snow happens when cold." },
        { label: 'Hail can be ___.', options: ['dangerous', 'fluffy'], answer: 0, ask: "Hail can be blank. Tap dangerous, or fluffy.", why: "Hail can be dangerous.", hint: "Hail is hard balls of ice.", explain: "Dangerous. Hail can be dangerous." } ] },
      20: { kind: 'rows', rows: [
        { label: '', options: ['flakes', 'balls'], answer: 0, ask: "Snow falls as blank of ice. Tap flakes, or balls.", why: "Snow falls as flakes of ice.", hint: "Snow is soft and light.", explain: "Flakes. Snow falls as flakes of ice." },
        { label: '', options: ['becomes', 'happens'], answer: 1, ask: "Rain blank when it is warm. Tap becomes, or happens.", why: "Happens is the word.", hint: "Read the sentence in the book again.", explain: "Happens is the word." },
        { label: '', options: ['snow', 'dangerous'], answer: 1, ask: "Hail can be blank. Tap snow, or dangerous.", why: "Hail can be dangerous.", hint: "Hail is hard balls of ice.", explain: "Dangerous. Hail can be dangerous." } ] },
      23: { kind: 'sort',
        prompt: "Look at the map. Where does each country go?",
        visual: { key: 'img/u3_weather_key.jpg', map: 'img/u3_europe_map.jpg' },
        bins: [{ id: 'rs', label: 'Rain + snow', tone: 'blue' }, { id: 'snow', label: 'Snow', tone: 'gray' }, { id: 'cloudy', label: 'Cloudy', tone: 'green' }, { id: 'sunny', label: 'Sunny', tone: 'gold' }],
        cards: [
          { t: 'Germany', bin: 'rs', spot: [75, 34], why: "Germany has rain and snow today.", hint: "Look at the map. Find Germany's weather icon." },
          { t: 'Spain', bin: 'snow', spot: [33, 86], why: "Spain has snow today.", hint: "Look at the map. Find Spain's weather icon." },
          { t: 'France', bin: 'cloudy', spot: [54, 62], why: "France is cloudy today.", hint: "Look at the map. Find France's weather icon." },
          { t: 'Italy', bin: 'sunny', spot: [77, 64], why: "Italy is sunny today.", hint: "Look at the map. Find Italy's weather icon." } ] }
    },
    unit4: {
      10: { kind: 'choice', options: ['Fish fell from the sky.', 'It snowed a lot.'], answer: 0,
        why: "Fish fell from the sky in Sri Lanka.", hint: "Remember the surprise in the story!",
        explain: "Fish fell from the sky! That's what happened." },
      11: { kind: 'choice', options: ['A tornado', 'A big bird'], answer: 0,
        why: "A tornado's strong winds can pick up fish.", hint: "Think of very strong, spinning winds.",
        explain: "A tornado. Its strong winds can pick things up." },
      17: { kind: 'choice', options: ['Raining fish!', 'Snow and hail'], answer: 0,
        why: "The whole story is about raining fish.", hint: "What does every part of the story talk about?",
        explain: "Raining fish! That is the main idea." },
      18: { kind: 'choice', options: ['surprised', 'sleepy'], answer: 0,
        why: "Fish falling on your home is a big surprise!", hint: "How would you feel if fish fell on your house?",
        explain: "Surprised. People were surprised." },
      19: { kind: 'choice', options: ['Carry things far', 'Make snow'], answer: 0,
        why: "A tornado can carry things far.", hint: "A tornado is a very strong wind.",
        explain: "It can carry things far." },
      20: { kind: 'rows', rows: [
        { label: 'A ___ picked up fish.', options: ['tornado', 'rabbit'], answer: 0, ask: "A blank picked up fish. Tap tornado, or rabbit.", why: "A tornado picked up the fish.", hint: "Something with strong winds.", explain: "Tornado. A tornado picked up fish." },
        { label: 'Moved them into the ___.', options: ['sea', 'sky'], answer: 1, ask: "Moved them into the blank. Tap sea, or sky.", why: "The fish went up into the sky.", hint: "The fish went up, up, up.", explain: "Sky. It moved them into the sky." },
        { label: 'People were ___.', options: ['surprised', 'hungry'], answer: 0, ask: "People were blank. Tap surprised, or hungry.", why: "People were surprised.", hint: "How would you feel?", explain: "Surprised. People were surprised." } ] }
    },
    scienceReview: {
      5: { kind: 'choice', options: ['High clouds', 'Storm clouds'], answer: 1,
        why: "Storm clouds are dark and tall. They make rain.", hint: "Which clouds make rain?",
        explain: "Storm clouds. They are dark and tall." },
      6: { kind: 'choice', options: ['Rainbow', 'Tornado'], answer: 1,
        why: "A tornado is strong, spinning wind.", hint: "Remember the fish story!",
        explain: "Tornado. Strong spinning winds." },
      8: { kind: 'choice', options: ['Main idea', 'Detail'], answer: 0,
        why: "It's what the whole story is about.", hint: "Does it tell about the whole story?",
        explain: "It's the main idea of the animals story." },
      9: { kind: 'choice', options: ['Main idea', 'Detail'], answer: 1,
        why: "It's one little fact about storm clouds.", hint: "Is it the whole reading, or one little fact?",
        explain: "It's a detail. One little fact." }
    }
  }
};
