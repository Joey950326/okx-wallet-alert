import "server-only"

export function getAuthCredentials() {
	const username = process.env.AUTH_USERNAME?.trim()
	const password = process.env.AUTH_PASSWORD?.trim()

	if (!username || !password) {
		throw new Error("Missing AUTH_USERNAME or AUTH_PASSWORD in server environment")
	}

	return { username, password }
}
