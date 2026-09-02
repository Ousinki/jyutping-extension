import nodemailer from 'nodemailer';

export interface FeedbackAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface FeedbackData {
  email?: string;
  message: string;
  source?: string;
  version?: string;
  attachments?: FeedbackAttachment[];
}

export async function sendFeedbackEmail(data: FeedbackData): Promise<{ success: boolean; message: string }> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.SMTP_TO || 'support@ousin.cn';
  const from = process.env.SMTP_FROM || user || 'no-reply@jyutping.app';

  // Format HTML content
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 20px;">
        <h2 style="color: #7c3aed; margin: 0; font-size: 20px;">💬 粤语悬浮词典 - 新用户反馈</h2>
        <span style="color: #64748b; font-size: 13px;">提交时间：${timestamp}</span>
      </div>

      <div style="margin-bottom: 16px;">
        <strong style="color: #334155; font-size: 14px;">用户邮箱：</strong>
        <span style="color: #0f172a; font-size: 14px;">${data.email || '（用户未填写）'}</span>
      </div>

      <div style="margin-bottom: 16px;">
        <strong style="color: #334155; font-size: 14px;">来源版本：</strong>
        <span style="color: #64748b; font-size: 13px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${data.source || 'Chrome 扩展'} (v${data.version || '1.5.8'})</span>
      </div>

      <div style="margin-bottom: 20px;">
        <strong style="color: #334155; font-size: 14px; display: block; margin-bottom: 6px;">反馈内容：</strong>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; font-size: 14px; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${data.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>

      ${data.attachments && data.attachments.length > 0 ? `
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
          <strong style="color: #334155; font-size: 13px;">📎 附带截图 (${data.attachments.length} 张)：</strong>
          <span style="color: #64748b; font-size: 12px;">（请查阅邮件附件）</span>
        </div>
      ` : ''}
    </div>
  `;

  // If SMTP is configured, send real email
  if (host && user && pass) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    const mailAttachments = (data.attachments || []).map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    }));

    await transporter.sendMail({
      from: `"粤语词典反馈中心" <${from}>`,
      to,
      replyTo: data.email || undefined,
      subject: `[用户反馈] ${data.email ? data.email + ' : ' : ''}${data.message.slice(0, 30)}...`,
      html,
      attachments: mailAttachments,
    });

    return { success: true, message: '反馈邮件已成功投递！' };
  } else {
    // Development fallback
    console.log('[Feedback Mailer Dev Mode] Simulated sending feedback:');
    console.log({ email: data.email, message: data.message, attachmentsCount: data.attachments?.length || 0 });
    return { success: true, message: '（开发模拟）反馈已记录成功！' };
  }
}
