/** Lightweight vector artwork: no texture downloads or extra WebGL passes. */
export const submarineArt = `<svg viewBox="0 0 640 320" role="img" aria-label="Żółty batyskaf z okrągłymi iluminatorami">
<defs>
 <linearGradient id="hull" x2="0" y2="1"><stop stop-color="#fff1a1"/><stop offset=".3" stop-color="#f5c950"/><stop offset=".72" stop-color="#e8a62d"/><stop offset="1" stop-color="#b97424"/></linearGradient>
 <linearGradient id="brass" x2="0" y2="1"><stop stop-color="#fff2ad"/><stop offset=".45" stop-color="#dcaa48"/><stop offset=".7" stop-color="#9b621e"/><stop offset="1" stop-color="#f4ce72"/></linearGradient>
 <linearGradient id="glass" x2="1" y2="1"><stop stop-color="#8de4e2"/><stop offset=".45" stop-color="#268f9c"/><stop offset="1" stop-color="#163f60"/></linearGradient>
</defs>
<g fill="none" stroke="#b7e9e1" stroke-width="2" opacity=".45"><circle cx="560" cy="104" r="12"/><circle cx="590" cy="69" r="7"/><circle cx="574" cy="39" r="4"/><path d="M43 162h38m-53 24h49m-26 25h36" stroke-linecap="round"/></g>
<ellipse cx="323" cy="292" rx="187" ry="12" fill="#052d3b" opacity=".2"/>
<g stroke="#754b23" stroke-width="4" stroke-linejoin="round">
 <path d="M260 105V58q0-10 10-10h52v21h-37v36" fill="url(#brass)"/><rect x="315" y="43" width="19" height="31" rx="6" fill="#275566"/>
 <path d="M223 136v-27q0-15 15-15h76q15 0 15 15v27" fill="url(#hull)"/>
 <path d="m482 168 57-41v106l-57-36" fill="#ce6b3c"/><path d="M532 138v84" stroke="#f1ae61"/>
 <path d="M147 230 136 269h67l24-32m154-7 17 38h54l-20-47" fill="#c57631"/>
 <path d="M191 119h190c81 0 132 35 132 83s-51 69-132 69H191c-66 0-108-33-108-76s42-76 108-76Z" fill="url(#hull)"/>
 <path d="M174 134q-70 18-70 66m58 50q89 15 213 7" fill="none" stroke="#ffeab0" stroke-width="5" stroke-linecap="round" opacity=".7"/>
 <path d="M415 127q31 73 0 139" fill="none" stroke="#af792d"/>
 <g fill="url(#glass)" stroke="url(#brass)" stroke-width="12"><circle cx="199" cy="193" r="37"/><circle cx="306" cy="193" r="37"/></g>
 <g fill="none" stroke="#835724" stroke-width="3"><circle cx="199" cy="193" r="43"/><circle cx="306" cy="193" r="43"/></g>
 <g stroke="#c0fcf1" stroke-width="7" stroke-linecap="round" opacity=".65"><path d="m178 187 18-19m-9 37 29-31m69 13 18-19m-9 37 29-31"/></g>
 <g fill="#8e5f28" stroke="none"><circle cx="199" cy="151" r="3"/><circle cx="199" cy="235" r="3"/><circle cx="157" cy="193" r="3"/><circle cx="241" cy="193" r="3"/><circle cx="306" cy="151" r="3"/><circle cx="306" cy="235" r="3"/><circle cx="264" cy="193" r="3"/><circle cx="348" cy="193" r="3"/></g>
 <path d="M375 181h18m-18 12h18m-18 12h18" stroke="#885b28" stroke-linecap="round"/>
 <path d="M89 185H69v23h20" fill="url(#brass)"/><ellipse cx="65" cy="174" rx="8" ry="23" fill="#3f8790"/><ellipse cx="65" cy="222" rx="8" ry="23" fill="#3f8790"/><circle cx="65" cy="198" r="10" fill="url(#brass)"/>
</g></svg>`;

export const startShape = `<svg viewBox="0 0 360 125" aria-hidden="true"><defs><linearGradient id="startGold" x2="0" y2="1"><stop stop-color="#fff0a6"/><stop offset=".5" stop-color="#e4b349"/><stop offset="1" stop-color="#a96d29"/></linearGradient></defs><g stroke="#65451e" stroke-width="3" stroke-linejoin="round"><path d="M139 44V25h21V9h36v12h-22v23" fill="url(#startGold)"/><path d="m289 63 47-24v65l-47-20" fill="#c9943c"/><path d="M63 38h193q57 0 57 38t-57 38H63q-48 0-48-38t48-38Z" fill="url(#startGold)"/><path d="M68 49h185q45 0 45 27t-45 27H68q-39 0-39-27t39-27Z" fill="#225c66"/><circle cx="66" cy="76" r="17" fill="#eec467"/><path d="m62 67 12 9-12 9Z" fill="#173e4a" stroke="none"/><path d="M22 71H7v13h15" fill="#edc86c"/></g></svg>`;

export const speedDial = `<svg viewBox="0 0 200 178" aria-hidden="true"><defs><linearGradient id="dialGold" x2="0" y2="1"><stop stop-color="#ffe998"/><stop offset=".5" stop-color="#dca83f"/><stop offset="1" stop-color="#9d6328"/></linearGradient></defs><circle cx="100" cy="94" r="86" fill="url(#dialGold)" stroke="#67411d" stroke-width="3"/><circle cx="100" cy="94" r="73" fill="#fff1cb" stroke="#714b24" stroke-width="3"/><path d="M40 128a69 69 0 0 1 90-97" fill="none" stroke="#76a650" stroke-width="8"/><path d="M130 31a69 69 0 0 1 38 51" fill="none" stroke="#e4b145" stroke-width="8"/><path d="M168 82a69 69 0 0 1-8 46" fill="none" stroke="#cf653b" stroke-width="8"/><g stroke="#384d43" stroke-width="3">${Array.from({ length: 9 }, (_, i) => `<path d="M100 28v12" transform="rotate(${-120 + i * 30} 100 94)"/>`).join('')}</g><g id="speed-needle" style="transform-origin:100px 94px"><path d="m96 96 4-57 4 57Z" fill="#d14f35" stroke="#733a25" stroke-width="1.5"/></g><circle cx="100" cy="94" r="9" fill="url(#dialGold)" stroke="#67411d" stroke-width="3"/><g fill="#ffeaa2" stroke="#936124" stroke-width="2"><circle cx="100" cy="14" r="4"/><circle cx="22" cy="77" r="4"/><circle cx="178" cy="77" r="4"/><circle cx="48" cy="153" r="4"/><circle cx="152" cy="153" r="4"/></g></svg>`;
