# OCR assets

Coffee Recipe Buddy self-hosts the browser OCR runtime under `public/ocr/v7/`.
The scan flow is the only code path that loads it. Assets use the versioned URL
`/ocr/v7/` and receive immutable one-year cache headers.

- Tesseract.js 7.0.0 — Apache-2.0; `worker.min.js`.
- tesseract.js-core 7.0.0 — Apache-2.0; baseline, SIMD, LSTM, and SIMD+LSTM core variants.
- `@tesseract.js-data/eng` and `@tesseract.js-data/spa` 1.0.0 — MIT; English and Spanish 4.0.0 language data.

The worker is configured with same-origin `workerPath`, `corePath`, and `langPath`, and `workerBlobURL: false`; this avoids Blob-worker CSP exceptions. Asset updates require checksum review:

```
worker.min.js 576b7df7e20c5329a17ffa9c202a47eaa3e32500b253d4c7f38e7f2bc01457c3e
eng.traineddata.gz ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468
spa.traineddata.gz 6cd52c545bceeacb2e43fad64fc0703a711c482ba20d1ca4b6915c09de9973e6
tesseract-core.wasm.js 0bc6ce3e5fbbd0cd89706cf2fd70960e3372f4f01ee24265b26990808aaeb286
tesseract-core.wasm c7f5ace62ac0ad065e71e9c6725f1d7cdf82e7eda8fba532cbb9563964da7098
tesseract-core-simd.wasm.js 6b61ef4e911b5cf57e656bbfe983d6e2b3711a02dd164154ddda064566e8e09d
tesseract-core-simd.wasm 7d237a13edfeb0fa2f104744fccde0a00e0c076c3e23b7a8fc7af75ec9af2c3e
tesseract-core-lstm.wasm.js eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680
tesseract-core-lstm.wasm 66b17df6e20c5329a17ffa9c202a47eaa3e32500b253d4c7f38e7f2bc01457c3
tesseract-core-simd-lstm.wasm.js c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38
tesseract-core-simd-lstm.wasm 34e8d50cac216427d86bf397d610fdd9f49492539bbcdfbfccc4eda20c810bea
tesseract-core-relaxedsimd.wasm.js 843074aa5bad1cc6421b74a86201768ced9f244795e4d81435435a61a40ce535
tesseract-core-relaxedsimd.wasm 45f8c9b516df326b6ae6b493ed3a6289df5cbd10490e7b6ff8bf5b12ea42d1da
tesseract-core-relaxedsimd-lstm.wasm.js 861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3
tesseract-core-relaxedsimd-lstm.wasm 7985c92d4c64e7267d24cadffe1b2a1da6bf8aa55fdcaf953fe94fe122a24545
```
