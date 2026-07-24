// MySQL DATETIME 문자열("YYYY-MM-DD HH:MM:SS")에는 타임존 표기가 없다.
// new Date(str)로 바로 파싱하면 JS 엔진이 이를 로컬 타임존으로 해석할 수 있으므로
// (mysql2 풀은 timezone:'Z'로 항상 UTC 벽시계 값을 쓰고 읽도록 맞춰져 있음),
// 여기서 명시적으로 'Z'를 붙여 UTC로 고정해서 파싱한다.
function parseUtcDateTime(mysqlDateTimeString) {
  return new Date(`${mysqlDateTimeString.replace(' ', 'T')}Z`);
}

module.exports = { parseUtcDateTime };
