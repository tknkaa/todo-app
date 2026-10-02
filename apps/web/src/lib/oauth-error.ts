/** What to tell a person whose sign-in with GitHub did not work. `code` is better-auth's `?error=`. */
export function oauthErrorMessage(code: string) {
  switch (code) {
    case 'unable_to_link_account':
      return 'このメールアドレスは、すでにメールとパスワードで登録されています。メールとパスワードでログインしてください。'
    case 'email_not_found':
      return 'GitHub のアカウントにメールアドレスがありません。GitHub の設定でメールアドレスを追加してから、もう一度試してください。'
    case 'email_not_verified':
      return 'GitHub のメールアドレスが確認されていません。GitHub で確認してから、もう一度試してください。'
    default:
      return 'GitHub でのログインに失敗しました。もう一度試してください。'
  }
}
