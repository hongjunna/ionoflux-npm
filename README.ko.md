# IonoFlux Node.js SDK

IonoFlux의 우주기상·태양/지자기 시계열·TEC/MUF·HF 전파 예측·수신 관측 API를 호출하는 JavaScript/TypeScript 클라이언트입니다. **Node.js 22 이상**, Promise, ESM/CommonJS, TypeScript 선언을 지원하며 런타임 의존성이 없습니다. 첫 버전은 Python SDK API 범위에 맞춘 **0.1.3**입니다. [전체 API·옵션·오류 문서(영문)](https://github.com/hongjunna/ionoflux-npm#readme).

[공식 SDK 안내](https://ionoflux.runvia.app/ko/developers/npm) · [English guide](https://ionoflux.runvia.app/developers/npm)

```sh
npm install ionoflux@0.1.4
```

[계정 페이지](https://ionoflux.runvia.app/account)에서 Server API 키를 발급하고 서버 환경변수 `IONOFLUX_API_KEY`에 설정합니다. 서버 키 발급에는 서비스 URL이 필요합니다. 이 버전은 Node.js 전용입니다. 브라우저/React 클라이언트 코드·HTML·로그·Git에 Server 키를 넣지 마세요. Web 키 사용을 위해 Origin을 위조하지 마세요.

```js
import { Client, APIError } from 'ionoflux';
const client = new Client();
try {
  const flux = await client.solar.flux({ interval: '1d', limit: 30 });
  const path = await client.propagation.path({ from: 'Seoul', to: 'Tokyo', frequency: 14.074 });
  const spots = await client.observations.live({ band: '20m', minutes: 15 });
  console.log(flux.data, path.data, spots.data);
} catch (error) {
  if (error instanceof APIError) console.error(error.statusCode, error.detail);
  else throw error;
} finally {
  client.close();
}
```

CommonJS는 `const { Client } = require('ionoflux')`로 불러옵니다. `apiKey`를 직접 전달할 수도 있습니다. `sources()`와 `data.status(dataset?)`는 키 없이 호출하며, 설정된 키도 전송하지 않습니다. 모든 API는 GET입니다. 입력 옵션은 camelCase, 서버에 보내는 쿼리와 반환 JSON 필드 이름은 원래 API 형식을 유지합니다.

지원 리소스: `spaceWeather.current`, `solar.flux/sunspots/xray/wind`, `geomagnetic.kp/ap`, `statistics`, `alerts.list/scales`, `sources`, `data.status`, `ionosphere.tec/muf/stations`, `propagation.path/forecast/conditions`, `observations.live/paths/bands/callsign`. 메서드별 옵션·기본값·범위·예제는 위 영문 API 표에 있습니다. 타입 선언으로 자동완성과 허용 값 검사를 제공합니다.

응답은 `data`, `rawBody`(원본 바이트), `statusCode`, 허용된 안전한 `headers`, `rateLimit`을 포함합니다. 알 수 없는 필드·null·시간 문자열·단위·출처를 보존합니다. `rateLimit.resetSeconds`는 다음 초기화까지 남은 초이며 Unix 시간이 아닙니다. 시각 입력은 유효한 `Date` 또는 시간대가 명시된 ISO 문자열이며 UTC로 전송됩니다. 시계열 한도 기본 5000/최대 10000, 자동 페이지 분할은 없고 `1mo`는 고정 30일입니다. JavaScript 숫자 정밀도 제한이 적용됩니다.

`ConfigurationError`, `TransportError`, `ResponseError`, `APIError` 및 HTTP별 하위 오류를 제공합니다. 키 누락 오류에 발급 링크를 포함하고 API 오류에서 키를 마스킹합니다. 로컬 인자 오류는 `RangeError`입니다. `timeoutMs`는 매 시도 전체(본문 수신 포함) 제한으로 기본 10000ms, `maxRetries`는 기본 1/최대 3입니다. 일부 일시 네트워크 장애와 502/503/504만 제한 재시도하며, 429·Retry-After·잔여 한도 0에서는 자동 대기/HTTP 재시도를 하지 않습니다. HTTPS `/v1` 루트만 허용하고 리다이렉트를 따르지 않습니다. `close()`는 진행 중 요청을 취소하고 새 호출을 막지만 Node 공유 연결 풀이나 사용자 transport를 종료하지 않습니다. 사용자 transport는 AbortSignal을 준수해야 하며 전역 fetch 네트워크 설정은 앱이 관리합니다.

모든 요청에 `utm_source=nodejs`, `utm_medium=sdk`, `utm_content=0.1.4`, `User-Agent: ionoflux-node/0.1.4`이 포함됩니다. 태그에는 사용자/키/호스트 정보가 들어가지 않습니다. 브라우저용 키나 서비스 인증·한도 정책을 바꾸지 않습니다.

TEC/MUF 모델 지도와 전파 예측은 **모델 결과**, GIRO/이오노존데는 관측, PSK Reporter/WSPRnet은 실제 수신 보고입니다. 보고가 없다고 전파가 닫혔다고 판단하지 마세요. 수신기 간 SNR은 직접 비교할 수 없습니다. 응답의 모델 한계·출처를 유지하고 `sources()`의 제공자 조건을 확인하세요. WSPRnet 데이터는 상업 이용 제한이 있습니다. [PolyForm Noncommercial 1.0.0](https://github.com/hongjunna/ionoflux-npm/blob/main/LICENSE) 및 [NOTICE](https://github.com/hongjunna/ionoflux-npm/blob/main/NOTICE)가 적용되며 상업 이용은 별도 허락이 필요합니다.
