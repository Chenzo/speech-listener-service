const DEFAULT_WEBSOCKET_PORT = 3011;
const DEFAULT_KEYWORD_AUDIO_TRIGGERS = [
  { phrase: "rock", audio: "rl_short" },
  { phrase: "damn it", audio: "janet" },
  { phrase: "dammit", audio: "janet" },
  { phrase: "trap", audio: "trap" },
  { phrase: "my wife", audio: "mywife" }
];

module.exports = {
  DEFAULT_KEYWORD_AUDIO_TRIGGERS,
  DEFAULT_WEBSOCKET_PORT,
};
