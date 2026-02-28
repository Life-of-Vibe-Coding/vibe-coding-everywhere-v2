const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();
const html = md.render('<skill>Use A</skill>\nHello\nWorld');
console.log(html);
