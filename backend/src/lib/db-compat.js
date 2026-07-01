function getErrorMessage(error) {
  return String(error?.message || error || '').trim()
}

function isRelationMissingError(error, relationName) {
  const message = getErrorMessage(error)
  if (!message) return false

  const relationNeedle = relationName ? `'public.${relationName}'` : "'public."

  return (
    error?.code === 'PGRST205' ||
    message.includes('schema cache') ||
    (message.includes('Could not find the table') && message.includes(relationNeedle)) ||
    message.includes('does not exist')
  )
}

function isColumnMissingError(error, columnName) {
  const message = getErrorMessage(error)
  if (!message) return false

  if (!columnName) {
    return message.includes('column') && message.includes('does not exist')
  }

  return message.includes(`column "${columnName}" does not exist`) || message.includes(`Could not find the '${columnName}' column`)
}

module.exports = {
  getErrorMessage,
  isColumnMissingError,
  isRelationMissingError,
}
