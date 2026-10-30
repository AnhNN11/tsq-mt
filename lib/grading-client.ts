"use client";
export async function gradingFetch<T>(
  url: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers:
      data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Chưa thực hiện được thao tác bảng điểm.");
  return result;
}
export async function compressPaper(file: File): Promise<Blob> {
  if (file.size > 25 * 1024 * 1024 || !file.type.startsWith("image/"))
    throw new Error("Chọn ảnh dưới 25 MB. Nên dùng ảnh JPEG từ camera.");
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const ratio = Math.min(
      1,
      2200 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * ratio);
    canvas.height = Math.round(image.naturalHeight * ratio);
    if (canvas.width < 600 || canvas.height < 600)
      throw new Error(
        "Ảnh quá nhỏ. Chụp rõ toàn bộ phiếu với cạnh ngắn ít nhất 600 điểm ảnh.",
      );
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Thiết bị chưa hỗ trợ xử lý ảnh. Thử trình duyệt khác.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(
                new Error("Chưa chuyển được ảnh. Dùng ảnh JPEG hoặc PNG."),
              ),
        "image/jpeg",
        0.85,
      ),
    );
    if (blob.size > 3.5 * 1024 * 1024)
      throw new Error(
        "Ảnh sau khi nén vẫn quá lớn. Chụp lại ở độ phân giải thấp hơn.",
      );
    return blob;
  } finally {
    URL.revokeObjectURL(source);
  }
}
