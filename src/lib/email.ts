import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "Plan A Project <noreply@planaproject.io>";

export async function sendProjectInviteEmail({
  to,
  inviterName,
  projectName,
  signInUrl,
}: {
  to: string;
  inviterName: string;
  projectName: string;
  signInUrl: string;
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${inviterName} invited you to "${projectName}" on Plan A Project`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <span style="font-size:20px;font-weight:700;color:#a3e635;letter-spacing:-0.5px;">Plan A Project</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#171717;border:1px solid #262626;border-radius:12px;padding:40px 36px;">

              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#e5e5e5;line-height:1.3;">
                You've been invited
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#737373;line-height:1.6;">
                <strong style="color:#a3a3a3;">${inviterName}</strong> has invited you to join
                <strong style="color:#a3a3a3;">${projectName}</strong> on Plan A Project.
              </p>

              <!-- CTA -->
              <a href="${signInUrl}"
                style="display:inline-block;background:#a3e635;color:#0a0a0a;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;">
                Accept Invitation
              </a>

              <p style="margin:28px 0 0;font-size:13px;color:#525252;line-height:1.6;">
                If you don't have an account yet, clicking the button above will let you sign in with Google or Discord — your invitation will be applied automatically.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#404040;">
                You received this because someone invited you to a project on
                <a href="https://planaproject.io" style="color:#525252;">planaproject.io</a>.
                If this was unexpected, you can safely ignore it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
