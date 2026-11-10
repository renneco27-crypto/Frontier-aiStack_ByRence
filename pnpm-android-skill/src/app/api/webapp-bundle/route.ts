import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

function addDirectoryToZip(zip: JSZip, dirPath: string, basePath: string) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, basePath);
    } else if (fullPath.endsWith('.html') || fullPath.endsWith('.rsc') || fullPath.endsWith('.meta')) {
      const content = fs.readFileSync(fullPath);
      zip.file(relativePath, content);
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sha = searchParams.get('sha');

  const expectedSha = process.env.NEXT_PUBLIC_APP_CACHE_SHA || 'v8';
  
  if (sha !== expectedSha) {
    return new NextResponse('Unauthorized or SHA mismatch', { status: 401 });
  }

  const appDir = path.join(/*turbopackIgnore: true*/ process.cwd(), '.next/server/app');
  if (!fs.existsSync(appDir)) {
    return new NextResponse('App directory not found', { status: 404 });
  }

  try {
    const zip = new JSZip();
    addDirectoryToZip(zip, appDir, appDir);
    
    const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    
    return new NextResponse(zipBuffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="webapp.zip"',
        'Content-Length': zipBuffer.length.toString(),
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err: any) {
    return new NextResponse('Error generating zip: ' + err.message, { status: 500 });
  }
}
