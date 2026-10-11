/**
 * SCRIPT PHÂN LOẠI CAPTION BẰNG AI (DeepSeek / OpenAI)
 * 
 * Hỗ trợ quét:
 *  1. Thư mục con bài viết của Extension (chứa caption_original.txt / caption_facebook.txt / metadata.json)
 *  2. Thư mục phẳng chứa nhiều file .txt
 * 
 * Cách chạy:
 *   node scripts/classify_captions.mjs --dir "D:/Path/To/Your/Captions" --key "sk-your-deepseek-api-key"
 * hoặc set biến môi trường:
 *   $env:DEEPSEEK_API_KEY="sk-your-api-key"
 *   node scripts/classify_captions.mjs --dir "./downloads"
 */

import fs from 'fs';
import path from 'path';

// Đọc tham số dòng lệnh
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dir: '',
    key: process.env.DEEPSEEK_API_KEY || '',
    model: 'deepseek-chat',
    updateMetadata: true, // Nếu có metadata.json thì tự cập nhật
    limit: 0 // 0 = không giới hạn
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      options.dir = args[i + 1];
      i++;
    } else if (args[i] === '--key' && args[i + 1]) {
      options.key = args[i + 1];
      i++;
    } else if (args[i] === '--model' && args[i + 1]) {
      options.model = args[i + 1];
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--no-update') {
      options.updateMetadata = false;
    }
  }

  return options;
}

// Gọi API Gemini
async function classifyWithGemini(apiKey, captionText) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const prompt = `Bạn là trợ lý AI chuyên phân tích nội dung du lịch, ẩm thực từ caption Douyin, TikTok, Xiaohongshu.
Phân loại caption sau thành JSON với định dạng:
{
  "category": "food" | "sightseeing" | "other",
  "category_vn": "Đồ ăn" | "Địa điểm tham quan" | "Khác",
  "province": "Tên tỉnh/thành phố (ví dụ: Đà Lạt, Hà Nội, Ninh Bình, Sapa, Bắc Kinh... Không có thì ghi 'Không rõ')",
  "location_or_dish": "Tên món ăn hoặc địa danh cụ thể nếu có",
  "summary": "Tóm tắt ngắn 1 câu"
}
Chỉ trả về JSON hợp lệ.

Caption:
"""${captionText}"""`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(rawText);
}

// Gọi API DeepSeek / OpenAI
async function classifyWithDeepSeek(apiKey, model, captionText) {
  const systemPrompt = `Bạn là trợ lý AI chuyên phân tích nội dung du lịch, ẩm thực và đời sống từ caption video mạng xã hội (Douyin, TikTok, Xiaohongshu, Instagram).
Nhiệm vụ của bạn là đọc nội dung caption (có thể là tiếng Trung, tiếng Việt, tiếng Anh hoặc tiếng Nga) và phân loại ra định dạng JSON duy nhất với các trường:
{
  "category": "food" | "sightseeing" | "other",
  "category_vn": "Đồ ăn" | "Địa điểm tham quan" | "Khác",
  "province": "Tên tỉnh/thành phố được nhắc tới hoặc nơi diễn ra nội dung (ví dụ: Đà Lạt, Hà Nội, Đà Nẵng, Ninh Bình, Sapa, Bắc Kinh, Thượng Hải... Nếu không xác định được thì ghi 'Không rõ')",
  "location_or_dish": "Tên món ăn, quán ăn hoặc địa danh du lịch/thắng cảnh cụ thể (nếu có, không có thì để rỗng)",
  "summary": "Tóm tắt ngắn gọn 1 câu về nội dung bài đăng"
}
Lưu ý: Chỉ trả về JSON thuần túy, không dùng markdown bọc bên ngoài.`;

  const userPrompt = `Caption cần phân loại:\n"""${captionText}"""`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const rawText = result.choices?.[0]?.message?.content || '{}';

  try {
    return JSON.parse(rawText);
  } catch (err) {
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

async function classifyWithAI(apiKey, model, captionText) {
  if (apiKey.startsWith('AIza')) {
    return classifyWithGemini(apiKey, captionText);
  }
  return classifyWithDeepSeek(apiKey, model, captionText);
}

// Quét tìm tất cả bài viết hoặc file caption trong thư mục
function scanCaptions(targetDir) {
  const items = [];
  if (!fs.existsSync(targetDir)) return items;

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      // Cấu trúc theo folder con bài viết của Extension: Douyin_Offline/<post_folder>/
      const capOriginal = path.join(fullPath, 'caption_original.txt');
      const capFacebook = path.join(fullPath, 'caption_facebook.txt');
      const capPostFb = path.join(fullPath, 'post_facebook.txt');
      const capGeneric = path.join(fullPath, 'caption.txt');
      const metaPath = path.join(fullPath, 'metadata.json');

      let text = '';
      let sourceFile = '';

      if (fs.existsSync(capOriginal)) {
        text = fs.readFileSync(capOriginal, 'utf-8').trim();
        sourceFile = capOriginal;
      }
      if (!text && fs.existsSync(capFacebook)) {
        text = fs.readFileSync(capFacebook, 'utf-8').trim();
        sourceFile = capFacebook;
      }
      if (!text && fs.existsSync(capPostFb)) {
        text = fs.readFileSync(capPostFb, 'utf-8').trim();
        sourceFile = capPostFb;
      }
      if (!text && fs.existsSync(capGeneric)) {
        text = fs.readFileSync(capGeneric, 'utf-8').trim();
        sourceFile = capGeneric;
      }

      if (text) {
        items.push({
          type: 'folder',
          folderName: entry.name,
          folderPath: fullPath,
          sourceFile,
          metadataFile: fs.existsSync(metaPath) ? metaPath : null,
          caption: text
        });
      }
    } else if (entry.isFile() && entry.name.endsWith('.txt')) {
      // Cấu trúc phẳng: file .txt trực tiếp
      const text = fs.readFileSync(fullPath, 'utf-8').trim();
      if (text) {
        items.push({
          type: 'file',
          fileName: entry.name,
          filePath: fullPath,
          sourceFile: fullPath,
          metadataFile: null,
          caption: text
        });
      }
    }
  }

  return items;
}

// Xuất file CSV (kèm BOM UTF-8 để mở trên Excel không bị lỗi font)
function exportToCsv(results, outputPath) {
  const header = ['STT', 'Tên File/Thư Mục', 'Phân Loại', 'Tên Thể Loại', 'Tỉnh/Thành', 'Món/Địa Danh Cụ Thể', 'Tóm Tắt', 'Trích Đoạn Caption'];
  const rows = results.map((r, idx) => {
    const esc = (val) => `"${String(val || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    return [
      idx + 1,
      esc(r.targetName),
      esc(r.classification?.category || ''),
      esc(r.classification?.category_vn || ''),
      esc(r.classification?.province || ''),
      esc(r.classification?.location_or_dish || ''),
      esc(r.classification?.summary || ''),
      esc((r.caption || '').slice(0, 150))
    ].join(',');
  });

  const bom = '\uFEFF';
  const csvContent = bom + [header.join(','), ...rows].join('\r\n');
  fs.writeFileSync(outputPath, csvContent, 'utf-8');
}

async function main() {
  const options = parseArgs();

  console.log('==================================================');
  console.log('       AI CAPTION CLASSIFIER (DeepSeek)          ');
  console.log('==================================================\n');

  if (!options.dir) {
    console.error('❌ Chưa chỉ định thư mục cần quét caption!');
    console.log('👉 Cách dùng:');
    console.log('   node scripts/classify_captions.mjs --dir "ĐƯỜNG_DẪN_THƯ_MỤC" --key "DEEPSEEK_API_KEY"\n');
    console.log('Ví dụ:');
    console.log('   node scripts/classify_captions.mjs --dir "./downloads" --key "sk-xxxxxx"\n');
    process.exit(1);
  }

  if (!options.key) {
    console.error('❌ Thiếu API Key DeepSeek!');
    console.log('👉 Hãy truyền cờ: --key "sk-xxxx" hoặc thiết lập biến môi trường DEEPSEEK_API_KEY');
    process.exit(1);
  }

  const resolvedDir = path.resolve(options.dir);
  console.log(`📂 Thư mục quét: ${resolvedDir}`);
  console.log(`🤖 AI Model: ${options.model}`);

  const items = scanCaptions(resolvedDir);
  if (items.length === 0) {
    console.log('⚠️ Không tìm thấy file .txt hoặc thư mục bài viết nào có caption!');
    process.exit(0);
  }

  const listToProcess = options.limit > 0 ? items.slice(0, options.limit) : items;
  console.log(`🔍 Tìm thấy ${items.length} bài/file caption. Sẽ xử lý: ${listToProcess.length} mục.\n`);

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < listToProcess.length; i++) {
    const item = listToProcess[i];
    const targetName = item.folderName || item.fileName;
    const progress = `[${i + 1}/${listToProcess.length}]`;

    console.log(`${progress} Đang phân loại: "${targetName}"...`);

    try {
      // Cắt bớt caption nếu quá dài để tiết kiệm token
      const trimmedCaption = item.caption.slice(0, 1500);
      const classified = await classifyWithAI(options.key, options.model, trimmedCaption);

      console.log(`   🏷️  Loại: ${classified.category_vn || classified.category} | 📍 Tỉnh: ${classified.province || 'Không rõ'} | 🎯 Cụ thể: ${classified.location_or_dish || 'N/A'}`);

      // Nếu có metadata.json và cho phép update
      if (options.updateMetadata && item.metadataFile) {
        try {
          const metaContent = JSON.parse(fs.readFileSync(item.metadataFile, 'utf-8'));
          metaContent.category = classified.category;
          metaContent.categoryVn = classified.category_vn;
          if (classified.province && classified.province !== 'Không rõ') {
            metaContent.province = classified.province;
          }
          if (classified.location_or_dish) {
            metaContent.locationOrDish = classified.location_or_dish;
          }
          metaContent.aiClassifiedAt = new Date().toISOString();
          fs.writeFileSync(item.metadataFile, JSON.stringify(metaContent, null, 2), 'utf-8');
          console.log(`   💾 Đã cập nhật metadata.json`);
        } catch (mErr) {
          console.warn(`   ⚠️ Không thể ghi metadata.json: ${mErr.message}`);
        }
      }

      results.push({
        targetName,
        sourceFile: item.sourceFile,
        caption: item.caption,
        classification: classified
      });

      successCount++;
    } catch (err) {
      console.error(`   ❌ Lỗi: ${err.message}`);
      failCount++;
      results.push({
        targetName,
        sourceFile: item.sourceFile,
        caption: item.caption,
        error: err.message
      });
    }

    // Nghỉ nhẹ 300ms giữa các request để tránh rate limit
    if (i < listToProcess.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Xuất file kết quả
  const jsonOut = path.join(resolvedDir, 'classification_results.json');
  const csvOut = path.join(resolvedDir, 'classification_results.csv');

  fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2), 'utf-8');
  exportToCsv(results, csvOut);

  console.log('\n==================================================');
  console.log(`🎉 HOÀN TẤT! Thành công: ${successCount} | Thất bại: ${failCount}`);
  console.log(`📄 File JSON kết quả: ${jsonOut}`);
  console.log(`📊 File CSV (mở Excel): ${csvOut}`);
  console.log('==================================================');
}

main();
