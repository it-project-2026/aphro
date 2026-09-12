async function testRest() {
  const url = 'https://npeeobcpffmlyiknszhh.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWVvYmNwZmZtbHlpa25zemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzQ0MzAsImV4cCI6MjEwNDQxMDQzMH0.-48iDwqMfKHBfVcJx6A_McxWl2StzFjzyHFPaKMZq98';
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWVvYmNwZmZtbHlpa25zemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzQ0MzAsImV4cCI6MjEwNDQxMDQzMH0.-48iDwqMfKHBfVcJx6A_McxWl2StzFjzyHFPaKMZq98',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWVvYmNwZmZtbHlpa25zemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzQ0MzAsImV4cCI6MjEwNDQxMDQzMH0.-48iDwqMfKHBfVcJx6A_McxWl2StzFjzyHFPaKMZq98'
      }
    });
    const data = await res.json();
    console.log('Definitions in OpenAPI schema:', Object.keys(data.definitions || {}));
    console.log('Paths:', Object.keys(data.paths || {}));
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

testRest();
