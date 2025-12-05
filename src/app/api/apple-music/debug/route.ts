// Debug endpoint to test Apple Music API responses
// This returns instructions for testing in browser console

import { NextResponse } from 'next/server';

export async function GET() {
  const testCode = `
// Run this in browser console after connecting Apple Music:

async function testHeavyRotation() {
  const music = window.MusicKit.getInstance();
  if (!music.isAuthorized) {
    console.log('Not authorized - connect Apple Music first');
    return;
  }

  console.log('\\n=== HEAVY ROTATION (/v1/me/history/heavy-rotation) ===');
  try {
    const hr = await music.api.music('/v1/me/history/heavy-rotation', { limit: 25 });
    console.log('Raw response:', hr);
    const items = hr.data?.data || [];
    console.log(\`Found \${items.length} items:\\n\`);
    items.forEach((item, i) => {
      const name = item.attributes?.name || item.attributes?.artistName || 'Unknown';
      const artist = item.attributes?.artistName || '';
      const type = item.type;
      console.log(\`\${i+1}. [\${type}] \${name}\${artist ? ' - ' + artist : ''}\`);
    });
  } catch (e) {
    console.error('Heavy rotation error:', e);
  }

  console.log('\\n=== RECENTLY PLAYED (/v1/me/recent/played) ===');
  try {
    const rp = await music.api.music('/v1/me/recent/played', { limit: 25 });
    console.log('Raw response:', rp);
    const items = rp.data?.data || [];
    console.log(\`Found \${items.length} items:\\n\`);
    items.forEach((item, i) => {
      const name = item.attributes?.name || 'Unknown';
      const artist = item.attributes?.artistName || '';
      const type = item.type;
      console.log(\`\${i+1}. [\${type}] \${name}\${artist ? ' - ' + artist : ''}\`);
    });
  } catch (e) {
    console.error('Recently played error:', e);
  }

  console.log('\\n=== RECENTLY PLAYED TRACKS (/v1/me/recent/played/tracks) ===');
  try {
    const rpt = await music.api.music('/v1/me/recent/played/tracks', { limit: 25 });
    console.log('Raw response:', rpt);
    const items = rpt.data?.data || [];
    console.log(\`Found \${items.length} items:\\n\`);
    items.forEach((item, i) => {
      const name = item.attributes?.name || 'Unknown';
      const artist = item.attributes?.artistName || '';
      console.log(\`\${i+1}. \${name} - \${artist}\`);
    });
  } catch (e) {
    console.error('Recently played tracks error:', e);
  }

  console.log('\\n=== RECOMMENDATIONS (/v1/me/recommendations) ===');
  try {
    const rec = await music.api.music('/v1/me/recommendations', { limit: 10 });
    console.log('Raw response:', rec);
  } catch (e) {
    console.error('Recommendations error:', e);
  }

  console.log('\\n=== LIBRARY ARTISTS (first 10) ===');
  try {
    const lib = await music.api.music('/v1/me/library/artists', { limit: 10 });
    const items = lib.data?.data || [];
    console.log(\`Found \${items.length} artists:\\n\`);
    items.forEach((item, i) => {
      console.log(\`\${i+1}. \${item.attributes?.name}\`);
    });
  } catch (e) {
    console.error('Library artists error:', e);
  }
}

testHeavyRotation();
`;

  return NextResponse.json({
    message: 'Copy the code below and paste in browser console at interchord.stonefrog.com (after connecting Apple Music)',
    code: testCode
  }, { status: 200 });
}
