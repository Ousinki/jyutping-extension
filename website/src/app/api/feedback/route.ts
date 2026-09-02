import { NextRequest, NextResponse } from 'next/server';
import { sendFeedbackEmail, FeedbackAttachment } from '@/lib/mailer';

// CORS response helper
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let message = '';
    let email = '';
    const attachments: FeedbackAttachment[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      message = (formData.get('message') as string) || '';
      email = (formData.get('email') as string) || '';

      const fileKeys = ['attachment', 'attachment_2', 'attachment_3', 'file', 'image'];
      for (const key of fileKeys) {
        const file = formData.get(key);
        if (file && typeof file === 'object' && 'arrayBuffer' in file) {
          const blob = file as File;
          const buffer = Buffer.from(await blob.arrayBuffer());
          attachments.push({
            filename: blob.name || `screenshot_${attachments.length + 1}.png`,
            content: buffer,
            contentType: blob.type || 'image/png',
          });
        }
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      message = body.message || '';
      email = body.email || '';
    }

    if (!message.trim()) {
      return NextResponse.json(
        { success: false, message: '反馈内容不能为空' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const result = await sendFeedbackEmail({
      email,
      message,
      attachments,
      source: 'Chrome 扩展 & 官网门户',
    });

    return NextResponse.json(result, {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (error: unknown) {
    console.error('Feedback API error:', error);
    const errMessage = error instanceof Error ? error.message : '服务器内部错误';
    return NextResponse.json(
      { success: false, message: errMessage },
      { status: 500, headers: corsHeaders() }
    );
  }
}
