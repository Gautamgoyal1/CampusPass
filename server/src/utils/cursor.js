export const encodeCursor = (data) => {
  if (!data) return null;
  return Buffer.from(JSON.stringify(data)).toString('base64url');
};

export const decodeCursor = (cursorString) => {
  if (!cursorString) return null;
  try {
    const json = Buffer.from(cursorString, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (parsed && parsed.starts_at && parsed.id) {
      return parsed;
    }
    return null;
  } catch (err) {
    return null;
  }
};
