const fs = require('fs');
const glob = require('glob');

const htmlFiles = glob.sync('*.html');
const strings = new Set();

htmlFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const patterns = [
    /textContent\s*=\s*["']([^"']+)["']/g,
    /innerHTML\s*=\s*["']([^"']*[^"'>])["']/g,
    /placeholder\s*=\s*["']([^"']+)["']/g,
    /aria-label\s*=\s*["']([^"']+)["']/g,
    /<button[^>]*>([^<]+)<\/button>/g,
    /<a[^>]*>([^<]+)<\/a>/g,
    /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/g,
    /<p[^>]*>([^<]+)<\/p>/g,
    /<label[^>]*>([^<]+)<\/label>/g,
    /<option[^>]*>([^<]+)<\/option>/g,
    /title\s*=\s*["']([^"']+)["']/g,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const text = match[1].trim();
      if (text.length > 1 && text.length < 200 && !text.match(/^[0-9\s\-\.\,\:\;\/]+$/)) {
        strings.add(text);
      }
    }
  });
});

console.log('Found', strings.size, 'unique strings');
Array.from(strings).sort().forEach(s => console.log(s));