const DEFAULT_WEBSOCKET_PORT = 3011;
const DEFAULT_KEYWORD_AUDIO_TRIGGERS = [
  { phrase: "rock", audio: "rl_short" },
  { phrase: "damn it", audio: "janet" },
  { phrase: "dammit", audio: "janet" },
  { phrase: "trap", audio: "trap" },
  { phrase: "dicks", audio: "dicks" },
  { phrase: "marx brothers", audio: "mbrothers" },
  { phrase: "marks brothers", audio: "mbrothers" },
  { phrase: "fire", audio: "fire" },
  { phrase: "blast them", audio: "blastem" },
  { phrase: "blast em", audio: "blastem" },
  { phrase: "my wife", audio: "mywife" },
  { phrase: "we did it", audio: "doradidit" },
];

module.exports = {
  DEFAULT_KEYWORD_AUDIO_TRIGGERS,
  DEFAULT_WEBSOCKET_PORT,
};
