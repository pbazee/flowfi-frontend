function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export async function filesToDataUrls(fileList, options = {}) {
  const files = Array.from(fileList || [])
  const maxSizeBytes = options.maxSizeBytes || 3 * 1024 * 1024

  for (const file of files) {
    if (file.size > maxSizeBytes) {
      throw new Error(`${file.name} is too large. Please keep each image under 3MB.`)
    }
  }

  return Promise.all(files.map((file) => readFileAsDataUrl(file)))
}
