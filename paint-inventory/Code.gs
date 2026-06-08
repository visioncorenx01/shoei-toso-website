// ===== 設定 =====
const MASTER_SHEET_NAME = '在庫マスタ';

function getMasterSheetAndHeader() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!sheet) {
    throw new Error('在庫マスタシートが見つかりません: ' + MASTER_SHEET_NAME);
  }
  const values = sheet.getDataRange().getValues();
  if (values.length < 1) {
    throw new Error('在庫マスタにヘッダー行がありません');
  }
  const header = values[0];
  return { sheet, header, values };
}

// ===== フォーム送信時：フォームの内容をそのまま在庫マスタと連携 =====
// ・商品名は完全一致 or 省略形（マスタの商品名がフォームの入力で始まっていればOK）で照合
// ・色番号を空で送ったときは商品名だけで行を探す
function onFormSubmit(e) {
  const nv = e && e.namedValues ? e.namedValues : {};

  const itemName  = (nv['商品名'] || [''])[0].trim();
  const mode     = (nv['区分']   || [''])[0].trim();
  const maker    = (nv['メーカー'] || [''])[0].trim();
  const colorCode = (nv['色番号'] || [''])[0].trim();
  const qtyStr   = (nv['数量'] || nv['缶数'] || ['0'])[0];
  const note     = (nv['備考'] || [''])[0].trim();

  if (!itemName || !mode) return;

  let qty = Number(qtyStr);
  if (!Number.isFinite(qty) || qty < 0) {
    var num = String(qtyStr).replace(/[^0-9.]/g, '');
    qty = num.length > 0 ? parseFloat(num) : 0;
  }
  if (!qty) qty = 1;

  const { sheet, header, values } = getMasterSheetAndHeader();
  const nameColIndex     = header.indexOf('商品名');
  const makerColIndex    = header.indexOf('メーカー');
  const colorColIndex    = header.indexOf('色番号');
  const capacityColIndex = header.indexOf('容量');
  const stockColIndex    = header.indexOf('在庫数');
  const locationColIndex = header.indexOf('保管場所');
  const noteColIndex     = header.indexOf('備考');

  if (nameColIndex === -1 || stockColIndex === -1) {
    throw new Error('在庫マスタに「商品名」または「在庫数」列がありません');
  }

  var targetRow = -1;
  for (var i = 1; i < values.length; i++) {
    var rowName  = String(values[i][nameColIndex] || '').trim();
    var rowColor = String(values[i][colorColIndex] != null ? values[i][colorColIndex] : '').trim();
    if (!rowName) continue;
    // 商品名：完全一致、またはマスタの商品名がフォームの入力で始まっている（省略形）
    var nameMatch = (rowName === itemName) || (itemName && rowName.indexOf(itemName) === 0);
    if (!nameMatch) continue;
    if (colorCode) {
      if (rowColor !== colorCode) continue;
    }
    targetRow = i;
    break;
  }

  if (targetRow >= 0) {
    var current = Number(values[targetRow][stockColIndex] || 0);
    if (!Number.isFinite(current)) current = 0;
    if (mode === '入庫') current += qty;
    else if (mode === '出庫') current -= qty;
    if (current < 0) current = 0;
    sheet.getRange(targetRow + 1, stockColIndex + 1).setValue(current);
  } else {
    var newStock = mode === '入庫' ? qty : 0;
    var newRow = [
      itemName,
      maker,
      colorCode,
      '',
      newStock,
      '',
      note
    ];
    sheet.appendRow(newRow);
  }
}

// ===== 在庫一覧（画面用） =====
function getInventory() {
  const { sheet, header, values } = getMasterSheetAndHeader();

  const nameColIndex     = header.indexOf('商品名');
  const makerColIndex    = header.indexOf('メーカー');
  const colorColIndex    = header.indexOf('色番号');
  const capacityColIndex = header.indexOf('容量');
  const stockColIndex    = header.indexOf('在庫数');
  const locationColIndex = header.indexOf('保管場所');
  const noteColIndex     = header.indexOf('備考');

  if (nameColIndex === -1 || makerColIndex === -1 || colorColIndex === -1 ||
      capacityColIndex === -1 || stockColIndex === -1 ||
      locationColIndex === -1 || noteColIndex === -1) {
    throw new Error('在庫マスタのヘッダー（商品名〜備考）を確認してください');
  }

  var result = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var name = row[nameColIndex];
    if (!name) continue;
    result.push({
      rowIndex:  i + 1,
      name:      String(name || ''),
      maker:     String(row[makerColIndex]    || ''),
      colorCode: String(row[colorColIndex]    || ''),
      capacity:  String(row[capacityColIndex] || ''),
      quantity:  Number(row[stockColIndex]) || 0,
      location:  String(row[locationColIndex] || ''),
      note:      String(row[noteColIndex]     || '')
    });
  }
  return result;
}

// ===== 商品マスタの新規登録・更新（画面のフォームから） =====
function saveItem(item) {
  const { sheet, header } = getMasterSheetAndHeader();

  const nameColIndex     = header.indexOf('商品名');
  const makerColIndex    = header.indexOf('メーカー');
  const colorColIndex    = header.indexOf('色番号');
  const capacityColIndex = header.indexOf('容量');
  const stockColIndex    = header.indexOf('在庫数');
  const locationColIndex = header.indexOf('保管場所');
  const noteColIndex     = header.indexOf('備考');

  var rowIndex = Number(item.rowIndex || 0);

  if (rowIndex && rowIndex > 1 && rowIndex <= sheet.getLastRow()) {
    sheet.getRange(rowIndex, nameColIndex + 1).setValue(item.name);
    sheet.getRange(rowIndex, makerColIndex + 1).setValue(item.maker);
    sheet.getRange(rowIndex, colorColIndex + 1).setValue(item.colorCode);
    sheet.getRange(rowIndex, capacityColIndex + 1).setValue(item.capacity || '');
    sheet.getRange(rowIndex, stockColIndex + 1).setValue(Number(item.quantity));
    sheet.getRange(rowIndex, locationColIndex + 1).setValue(item.location || '');
    sheet.getRange(rowIndex, noteColIndex + 1).setValue(item.note || '');
  } else {
    var newRow = [
      item.name,
      item.maker,
      item.colorCode,
      item.capacity || '',
      Number(item.quantity) || 0,
      item.location || '',
      item.note || ''
    ];
    sheet.appendRow(newRow);
  }
  return getInventory();
}

// ===== 行削除（画面の「削除」ボタン） =====
function deleteItem(rowIndex) {
  const { sheet } = getMasterSheetAndHeader();
  var r = Number(rowIndex || 0);
  if (!r || r <= 1 || r > sheet.getLastRow()) {
    throw new Error('削除対象の行番号が不正です: ' + r);
  }
  sheet.deleteRow(r);
  return getInventory();
}

// ===== 入庫・出庫（画面の入庫/出庫ボタン） =====
function adjustQuantity(rowIndex, mode, qty) {
  const { sheet, header, values } = getMasterSheetAndHeader();
  var r = Number(rowIndex || 0);
  var delta = Number(qty);

  if (!r || r <= 1 || r > sheet.getLastRow()) {
    throw new Error('更新対象の行番号が不正です: ' + r);
  }
  if (!Number.isFinite(delta) || delta <= 0) {
    throw new Error('数量が不正です: ' + delta);
  }

  const stockColIndex = header.indexOf('在庫数');
  if (stockColIndex === -1) {
    throw new Error('在庫マスタに「在庫数」列がありません');
  }

  var idx = r - 1;
  var current = Number(values[idx][stockColIndex]) || 0;
  if (!Number.isFinite(current)) current = 0;

  if (mode === '入庫') current += delta;
  else if (mode === '出庫') current -= delta;
  if (current < 0) current = 0;

  sheet.getRange(r, stockColIndex + 1).setValue(current);
  return getInventory();
}

// ===== Webアプリとして HTML を返す =====
function doGet(e) {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('塗料在庫システム');
}
