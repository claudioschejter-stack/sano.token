const html = await fetch('https://vistaenergy.com/', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
}).then((r) => r.text());

const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
if (nextData) {
  const json = JSON.parse(nextData);
  const str = JSON.stringify(json);
  const paths = [...str.matchAll(/\/images\/[^"\\]+/g)].map((m) => m[0]);
  console.log([...new Set(paths)].filter((p) => /logo|header|brand|nav/i.test(p)).slice(0, 30));
}

const allImages = [...html.matchAll(/\/images\/[A-Za-z0-9_./-]+\.(?:png|svg|webp|jpg)/g)].map((m) => m[0]);
console.log('images:', [...new Set(allImages)].slice(0, 40));
