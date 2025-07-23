export let username = null

export function askUsername(callback) {
  const modal = document.getElementById('username-modal')
  const input = document.getElementById('username-input')
  const confirm = document.getElementById('confirm-username')

  modal.style.display = 'block'

  confirm.onclick = () => {
    const value = input.value.trim()
    if (value) {
      username = value
      modal.style.display = 'none'
      callback(value)
    }
  }
}