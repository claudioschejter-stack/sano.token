const UA = 'Mozilla/5.0';

const sites = {
  tec: 'https://www.tecpetrol.com/',
  vista: 'https://vistaenergy.com/',
  mad: 'https://www.madalenaenergy.com/',
  plus: 'https://www.pluspetrol.com/',
  gyp: 'https://www.gyp.com.ar/'
};

for (const [id, url] of Object.entries(sites)) {
  try {
    const html = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text());
    const all = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((m) => m[1]);
    const logos = all.filter((x) => /logo|brand|svg|png|webp|image/i.test(x));
    console.log('\n' + id, logos.slice(0, 20));
  } catch (error) {
    console.log(id, 'ERR', error.message);
  }
}
