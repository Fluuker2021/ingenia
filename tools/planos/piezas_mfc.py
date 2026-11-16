"""Piezas del DIAGRAMA MULTIFILAR DEL TABLERO DE CONTROL - CONEXIONADO DE E/S (plano de referencia del usuario,
22 hojas en el espacio modelo cada 975.162 mm). Coordenadas locales de cada hoja (x 0..806, y 158..681); el ancla
de las piezas tiene y = 0, de modo que el generador conserva la altura de la referencia y solo desplaza en x.
Los tramos horizontales de barras (barras_y) se quitan de las piezas: el generador dibuja las barras continuas
entre la primera y la última columna. Los TAG, códigos y nombres del proyecto de referencia se reemplazan por
marcadores {clave} o se eliminan; las referencias cruzadas (p. ej. 2.A:1) las reemplaza el generador por la
hoja real según su posición."""

H = 975.162


def R(h, x0, y0, x1, y1):
    """rectángulo en coordenadas locales de la hoja h (1..22)"""
    o = (h - 1) * H
    return (x0 + o, y0, x1 + o, y1)


def A(h, x, y=0):
    return ((h - 1) * H + x, y)


B120 = [664.85, 648.85, 632.85]          # barras L, N y PE de la distribución (hojas 1-4)
B24 = [384.85, 398.85]                   # barras +24 V y 0 V de los fusibles-borne (hoja 6)
BAI = [338.85, 314.85]                   # barras 24 VDC y 0 VDC de las entradas analógicas
BDO = [216.85]                           # retorno de las bobinas de los relés
BDI = [664.85]                           # alimentación de las entradas digitales
BAO = [512.85]                           # pantallas de las salidas analógicas

PIEZAS_KIT = {
    'fuente': 'Diagrama multifilar del tablero de control - conexionado de E/S (referencia del usuario)',
    'piezas': {
        # ---------------- hoja 1: acometidas ----------------
        'leyenda': dict(rects=[R(1, 18, 236, 140, 272)], ancla=A(1, 18)),
        'notas': dict(rects=[R(1, 15, 170, 420, 215)], ancla=A(1, 15), textos={
            're:^NOTA : 1\\. LA ACOMETIDA PARA EL TABLERO DE CONTROL': '{notas}'}),
        'a_spd': dict(rects=[R(1, 662, 255, 765, 668)], ancla=A(1, 0), textos={
            'CB20': '{q}', '6A': '{qv}', 'S202-C6': '{qm}', 'SPD1': '{s1}', 'SPD2': '{s2}', 'TIPO 2': '{tipo}',
            'OVR T2 40-': '{m1}', '275 P QS': '{m2}', 'OVR T2 40': '{m1}', '-275 P QS': '{m2}'}),
        'a_aux': dict(rects=[R(1, 385, 240, 806, 690)], ancla=A(1, 0), textos={
            're:^VIENE DEL TABLERO DE FUERZA': '{desde}', 'Alimentación 220 V 60 Hz 3F +PE': '{alim}',
            'TB2': '{tb}', 'UT16/UT16-PE': '{tbm}', 'MCB2': '{q}', '10A': '{qv}', 'S202-C10': '{qm}', 'MCB2.2': '{a1}', 'MCB2.4': '{a2}',
            'PE.2': '{pe}', 'ALIMENTACIÓN SISTEMA DE VENTILADORES ,LUMINARIA Y TOMACORRIENTE TABLERO ELÉCTRICO': '{desc}', '(NOTA 2)': '{nota}'}),
        'a_est': dict(rects=[R(1, 0, 575, 225, 690), R(1, 225, 615, 395, 690)], ancla=A(1, 0), textos={
            're:^VIENE DEL TABLERO DE DISTRIBUCI': '{desde}',
            'Alimentación 120 V 60 Hz 3F +PE': '{alim}', 'TB1': '{tb}', 'UT16/UT16-PE': '{tbm}', 'MCB1': '{q}', '16A': '{qv}', 'S202-C16': '{qm}',
            'PE.1': '{pe}', '(NOTA 1)': '{nota}'}),
        'a_cb1': dict(rects=[R(1, 200, 490, 290, 668)], ancla=A(1, 0), textos={'CB1': '{q}', '10A': '{qv}', 'S202-C10': '{qm}'}),
        'a_ps': dict(rects=[R(1, 200, 420, 290, 510)], ancla=A(1, 0), textos={'PS': '{ps}', '10A': '{psv}', '1606-XLB240E': '{psm}'}),
        'a_cb2': dict(rects=[R(1, 200, 240, 290, 420)], ancla=A(1, 0), textos={
            'CB2': '{q}', '6A': '{qv}', 'S202-C6': '{qm}', 'PS.-': '{a1}', 'PS.+': '{a2}', 'FUENTE DE 24VDC': '{desc}'}),
        'a_cb3': dict(rects=[R(1, 285, 240, 372, 668)], ancla=A(1, 0), textos={
            'CB3': '{q}', '10A': '{qv}', 'S202-C10': '{qm}', 'CB3.2': '{a1}', 'CB3.4': '{a2}', 'ALIMENTACIÓN DERIVACIONES': '{desc}'}),

        # ---------------- hojas 2-3: distribución de 120 Vac (columna: ancla en el polo L) ----------------
        'd_bus_izq': dict(rects=[R(3, 0, 615, 64, 672)], ancla=A(3, 0), barras_y=B120, textos={
            'CB3.2': '{l1}', 'CB3.4': '{l2}', 'PE.3': '{pe}', '120 VAC': '{v}'}),
        'd_bus_der': dict(rects=[R(2, 712, 615, 806, 672)], ancla=A(2, 712), barras_y=B120, textos={
            'CB3.2': '{l1}', 'CB3.4': '{l2}', 'PE.3': '{pe}', '120 VAC': '{v}'}),
        'd_fin': dict(rects=[R(3, 740, 615, 770, 640)], ancla=A(3, 754), barras_y=B120),
        'd_tb': dict(rects=[R(2, 205, 340, 232, 382)], ancla=A(2, 234), textos={'TB3': '{tb}', '4mm2': '{tbs}', 'UT 4': '{tbm}', 'UT4-PE': '{tbpe}'}),
        'd_int': dict(rects=[R(2, 118, 240, 200, 672)], ancla=A(2, 150), barras_y=B120, textos={
            'CB5': '{q}', '2A': '{qv}', 'S202-C2': '{qm}', 'CB5.2': '{a1}', 'CB5.4': '{a2}', 'ALIMENTACIÓN SALIDAS DIGITALES': '{desc}'}),
        'd_campo': dict(rects=[R(2, 290, 240, 374, 672), R(2, 360, 500, 395, 672), R(2, 285, 450, 302, 458)], ancla=A(2, 318), barras_y=B120, textos={
            'CB7': '{q}', '2A': '{qv}', 'S202-C2': '{qm}', 're:^INTERRUPTOR DE VIBRACI': '{desc}'}),
        'd_res': dict(rects=[R(3, 290, 240, 372, 672)], ancla=A(3, 318), barras_y=B120, textos={
            'CB15': '{q}', '2A': '{qv}', 'S202-C2': '{qm}', 'RESERVA': '{desc}'}),
        'd_pe': dict(rects=[R(3, 470, 540, 494, 640)], ancla=A(3, 480), barras_y=B120, textos={'PE4': '{pe}'}),

        # ---------------- hoja 4: servicios de 220 Vac ----------------
        's_bus_izq': dict(rects=[R(4, -5, 615, 70, 672)], ancla=A(4, 0), barras_y=B120, textos={
            'MCB2.2': '{l1}', 'MCB2.4': '{l2}', 'PE.2': '{pe}', '220 VAC': '{v}'}),
        's_fin': dict(rects=[R(4, 755, 615, 782, 640)], ancla=A(4, 768), barras_y=B120),
        's_lum': dict(rects=[R(4, 40, 205, 140, 672)], ancla=A(4, 78), barras_y=B120, textos={
            'CB15': '{q}', '4A': '{qv}', 'S202-C2': '{qm}', 'ITR': '{sq}', 'NSYDCM20': '{sqm}', 'TB4': '{tb}', '4mm2': '{tbs}', 'PT 4': '{tbm}',
            'LM': '{lm}', '6 W': '{lmv}', '7L4302300100': '{lmm}'}),
        's_vent': dict(rects=[R(4, 300, 205, 475, 672)], ancla=A(4, 342), barras_y=B120, textos={
            'CB16': '{q}', '4A': '{qv}', 'S202-C2': '{qm}', 'TR': '{th}', '0-60 ºC': '{thv}', 'KTS 011': '{thm}',
            'V1': '{v1}', 'E1': '{v2}', '191 m³/h': '{vv}', 'SK 3240700': '{vm}',
            'VENTILADOR': '{v1d}', 'EXTRACTOR': '{v2d}'}),
        's_toma': dict(rects=[R(4, 640, 230, 755, 672)], ancla=A(4, 690), barras_y=B120, textos={
            'CB17': '{q}', '4A': '{qv}', 'S202-C2': '{qm}', 'ID1': '{id}', '30 mA': '{ids}', '25 A': '{idv}', 'FH202 AC': '{idm1}', '-25/0.03': '{idm2}',
            'TM': '{tm}', '16A': '{tmv}', '03504.0-01': '{tmm}'}),

        # ---------------- hoja 5: PLC (CPU y módulos, por el centro de cada primitiva) ----------------
        'p_cpu': dict(rects=[R(5, 80, 265, 280, 640)], ancla=A(5, 80), centro=True, textos={
            'PLC': '{tag}', 'CPU': '{desc}', '5069-L320ER': '{modelo}', 'SLOT 0': '{slot}'}),
        'p_ana': dict(rects=[R(5, 280, 265, 324, 640)], ancla=A(5, 280), centro=True, textos={
            'AI1': '{tag}', 'MÓDULO ENTRADAS ANALÓGICAS': '{desc}', '5069-IF8 8 CANALES': '{modelo}', 'SLOT 1': '{slot}'}),
        'p_rele': dict(rects=[R(5, 412, 265, 488, 640)], ancla=A(5, 412), centro=True, textos={
            'DO1': '{tag}', 'MÓDULO SALIDAS RELÉ': '{desc}', '5069-OW16 16 CANALES': '{modelo}', 'SLOT 4': '{slot}'}),
        'p_fpd': dict(rects=[R(5, 563, 265, 608, 640)], ancla=A(5, 563), centro=True, textos={
            'CN1': '{tag}', 'SEPARADOR/ DISTRIBUIDOR DE POTENCIAL': '{desc}', '5069-FPD': '{modelo}'}),
        'p_dig': dict(rects=[R(5, 608, 265, 652, 640)], ancla=A(5, 608), centro=True, textos={
            'DI1': '{tag}', 'MÓDULO ENTRADAS DIGITALES': '{desc}', '5069-IA16 16 CANALES': '{modelo}', 'SLOT 6': '{slot}'}),
        'p_tap': dict(rects=[R(5, 696, 265, 735, 640)], ancla=A(5, 696), centro=True, textos={
            'TAP': '{tag}', 'TAPA TERMINADOR': '{desc}', '5069-ECR': '{modelo}'}),

        # ---------------- hoja 6: distribución de 24 Vdc ----------------
        'v_ps': dict(rects=[R(6, 0, 384, 125, 670)], ancla=A(6, 82), barras_y=B24, textos={'PS.+': '{a1}', 'PS.-': '{a2}'}),
        'v_xf': dict(rects=[R(6, 50, 338, 76, 366)], ancla=A(6, 82), textos={'XF1': '{tb}', '4mm2': '{tbs}', 'UT 4-L/': '{tbm1}', 'HESI (5X20)': '{tbm2}', '1 A': ''}),
        'v_par': dict(rects=[R(6, 125.5, 205, 176, 402)], ancla=A(6, 130), barras_y=B24, textos={
            '2A': '{bA}', '2B': '{bB}', '1 A': '{fv}', 'XF1.3': '{a1}', 'XF1.4': '{a2}', 'ALIMENTACIÓN ENTRADAS ANÁLOGAS 5069-IF8 -AI1': '{desc}'}),
        'v_plc': dict(rects=[R(6, 248, 490, 438, 668)], ancla=A(6, 248), textos={
            'PLC': '{tag}', 'Compact GuardLogix 5380 Controller': '{desc}', '5069-L320ER': '{modelo}', 'XF1.1': '{a1}', 'XF1.2': '{a2}', 'PE4': '{pe}'}),
        'v_hmi': dict(rects=[R(6, 503, 490, 612, 668)], ancla=A(6, 503), textos={
            'HMI': '{tag}', 'Panel View 7': '{desc}', '2711P-T7C22D9P': '{modelo}', 'XF1.9': '{a1}', 'XF1.10': '{a2}', 'PE5': '{pe}'}),
        'v_sw': dict(rects=[R(6, 630, 385, 806, 672)], ancla=A(6, 630), textos={
            'SW': '{tag}', '1783-CMS10DP': '{modelo}', 'XF1.7': '{a1}', 'XF1.8': '{a2}', 'PE6': '{pe}'}),
        'v_rut': dict(rects=[R(6, 620, 245, 806, 385)], ancla=A(6, 630), textos={
            'RUT': '{tag}', 'RUT956': '{modelo}', 'XF1.11': '{a1}', 'XF1.12': '{a2}', 'PE7': '{pe}'}),

        # ---------------- hojas 7-8: entradas analógicas (canal: ancla en el borne fusible A) ----------------
        'ai_div': dict(rects=[R(7, 0, 499, 806, 520)], ancla=A(7, 0)),
        'ai_bus': dict(rects=[R(7, 0, 300, 72, 350)], ancla=A(7, 74), barras_y=BAI, textos={'XF1.3': '{a1}', 'XF1.4': '{a2}'}),
        'ai_xf': dict(rects=[R(7, 30, 466, 70, 500)], ancla=A(7, 74), textos={'-XF2': '{tb}', '4mm2': '{tbs}', 'UT 4-L/': '{tbm1}', 'HESI (5X20)': '{tbm2}', '0,5 A': '{fv}'}),
        'ai_mod': dict(rects=[R(7, 40, 240, 73.5, 265)], ancla=A(7, 74), centro=True, textos={'AI1': '{tag}', '5069-IF8': '{modelo}', 'slot 1': '{slot}'}),
        'ai_sh': dict(rects=[R(7, 712, 210, 800, 272)], ancla=A(7, 714), omitir=[R(7, 765, 211, 800, 217)]),
        'ai_tx': dict(rects=[R(7, 124, 520, 204, 695), R(7, 134, 480, 212, 520), R(7, 153, 200, 233, 345), R(7, 153, 345, 229, 480), R(7, 149, 400, 153, 480)], ancla=A(7, 154), centro=True, barras_y=BAI, textos={
            're:^TRANSMISOR INDICADOR DE PRESI': '{tx}', '2A': '{bA}', '2B': '{bB}', '2': '{t1}', '3': '{t2}',
            'IN1+': '{in1}', 'IN1-': '{in2}', 'Presión en línea de aire comprimido': '{desc}', '0,5 A': '{fv}'}),
        'ai_clp': dict(rects=[R(7, 205, 520, 290, 695), R(7, 214, 480, 292, 520), R(7, 233, 200, 313, 345), R(7, 233, 345, 309, 480), R(7, 229, 400, 233, 480)], ancla=A(7, 234), centro=True, barras_y=BAI, textos={
            'CLP.+': '{a1}', 'CLP.-': '{a2}', 'SHIELD.1': '{a3}', '3A': '{bA}', '3B': '{bB}', '4': '{t1}', '5': '{t2}',
            'IN2+': '{in1}', 'IN2-': '{in2}', 'Presión diferencial de filtros': '{desc}', '0,5 A': '{fv}'}),

        # ---------------- hoja 9: salidas analógicas (canal: ancla en OUT+) ----------------
        'ao_div': dict(rects=[R(9, 0, 338, 806, 356)], ancla=A(9, 0)),
        'ao_tb': dict(rects=[R(9, 40, 448, 73, 470)], ancla=A(9, 78), textos={'TB5': '{tb}', '4mm2': '{tbs}', 'PTTB 4': '{tbm}'}),
        'ao_mod': dict(rects=[R(9, 20, 640, 53.5, 668)], ancla=A(9, 78), centro=True, textos={'AO1': '{tag}', '5069-OF8': '{modelo}', 'slot 3': '{slot}'}),
        'ao_sh': dict(rects=[R(9, 712, 500, 800, 668)], ancla=A(9, 718), barras_y=BAO),
        'ao_ch': dict(rects=[R(9, 54.5, 520, 134, 670), R(9, 15, 195, 145, 520), R(9, 145, 200, 160, 235)], ancla=A(9, 78), centro=True, barras_y=BAO, textos={
            'Referencia de velocidad del variador de frecuencia': '{desc}', '0': '{t1}', '1': '{t2}', 'OUT0+': '{o1}', 'OUT0-': '{o2}',
            '1A': '{bA}', '1B': '{bB}', 're:^HACIA TABLERO DE FUERZA REFERENCIA DE VELOCIDAD': '{dest}'}),
        'ao_res': dict(rects=[R(9, 134.5, 520, 214, 670), R(9, 145, 440, 230, 520)], ancla=A(9, 158), centro=True, barras_y=BAO, textos={
            'Reserva': '{desc}', '2': '{t1}', '3': '{t2}', 'OUT1+': '{o1}', 'OUT1-': '{o2}', '2A': '{bA}', '2B': '{bB}'}),

        # ---------------- hojas 10-13: salidas digitales y bobinas de los relés (canal: ancla en OUTn) ----------------
        'do_mod': dict(rects=[R(10, 40, 640, 71, 668)], ancla=A(10, 112), centro=True, textos={'DO1': '{tag}', '5069-OW16': '{modelo}', 'slot 4': '{slot}'}),
        'do_ch': dict(rects=[R(10, 151.9, 195, 232.1, 670)], ancla=A(10, 192), barras_y=BDO, textos={
            'Comando de arranque de válvula rotativa #2': '{desc}', '1': '{t}', 'OUT1': '{out}', 'CR2': '{cr}', '4NA/NC': '{crc}', 'LZS:PT5A5S15': '{crm}'}),
        'do_com': dict(rects=[R(10, 675, 520, 806, 600), R(10, 712.5, 600, 806, 670)], ancla=A(10, 736), textos={
            'CB5.2': '{a}', '8': '{t}', 'COM0': '{com}', '120 VAC': '{v}'}),
        'do_bus_izq': dict(rects=[R(10, 0, 205, 70, 228)], ancla=A(10, 112), barras_y=BDO, textos={'CB5.4': '{a}', '120VAC': '{v}'}),
        'do_bus_der': dict(rects=[R(10, 695, 205, 770, 228)], ancla=A(10, 672), barras_y=BDO, textos={'CR8.A2': '{a}', '120VAC': '{v}'}),

        # ---------------- hojas 14-17: contactos de los relés hacia la bornera ----------------
        'rc': dict(rects=[R(14, 150, 520, 300, 668)], ancla=A(14, 228), textos={
            'TB6': '{tb}', '2A': '{bA}', '2B': '{bB}', 'CR2': '{cr}', 'LZS:PT5A5S15': '{crm}', 'PTTB 4': '{tbm}',
            'Hacia tablero de fuerza comando de arranque de válvula rotativa #2': '{desc}'}),

        # ---------------- hojas 18-21: entradas digitales (canal: ancla en el borne) ----------------
        'di_fpd': dict(rects=[R(18, 10, 480, 160, 672)], ancla=A(18, 10), barras_y=BDI, textos={
            'CN1': '{tag}', '5069-FPD': '{modelo}', 'CB4.2': '{a1}', 'CB4.4': '{a2}', '120 VAC': '{v}'}),
        'di_bus_izq': dict(rects=[R(20, 0, 655, 123, 672)], ancla=A(20, 144), barras_y=BDI, textos={'XF5.16B': '{a}', '120 VAC': '{v}'}),
        'di_bus_der': dict(rects=[R(20, 705, 655, 806, 672)], ancla=A(20, 704), barras_y=BDI, textos={'XF6.8B': '{a}', '120VAC': '{v}'}),
        'di_xfb': dict(rects=[R(20, 95, 550, 140, 578)], ancla=A(20, 144), textos={'-XF5': '{tb}', 'UT 4-L/': '{tbm1}', 'HESI (5X20)': '{tbm2}', '4mm': '{tbs}'}),
        'di_xfa': dict(rects=[R(20, 95, 315, 135, 347)], ancla=A(20, 144), textos={
            '-XF5': '{tb}', '4mm2': '{tbs}', 'UT 4-L/': '{tbm1}', 'HESI (5X20)': '{tbm2}', '0,5 A': '{fv}'}),
        'di_mod': dict(rects=[R(20, 78, 240, 104, 262)], ancla=A(20, 144), textos={'DI2': '{tag}', '5069-IA16': '{modelo}', 'slot 7': '{slot}'}),
        'di_ch': dict(rects=[R(20, 183.9, 205, 264.1, 670)], ancla=A(20, 224), barras_y=BDI, textos={
            '2B': '{bB}', '2A': '{bA}', '2': '{t}', 'In-1': '{inn}', '0,5 A': '{fv}',
            're:^\\(INSTALACION EN CAMPO\\) INTERRUPTOR DE VELOCIDAD CERO': '{dest}', 'Velocidad baja de vávula rotativa #1': '{desc}'}),
        'di_clp': dict(rects=[R(20, 503.9, 205, 584.1, 670), R(20, 584.1, 440, 610, 490)], ancla=A(20, 544), barras_y=BDI, textos={
            'XF5.6B': '{a1}', 'XF5.6A': '{a2}', '6B': '{bB}', '6A': '{bA}', '6': '{t}', 'In-5': '{inn}', '0,5 A': '{fv}',
            'VIENE DEL CONTROLADOR DE LIMPIEZA': '{dest}', 'Estado del controlador de limpieza': '{desc}'}),

        # ---------------- hoja 22: controlador de limpieza ----------------
        'l_div': dict(rects=[R(22, 0, 400, 806, 425)], ancla=A(22, 0)),
        'l_ctrl': dict(rects=[R(22, 0, 415, 480, 681)], ancla=A(22, 0), textos={
            'CLP': '{tag}', 'DWYER-DCT 1022-DCP200A': '{modelo}', 'TARJETA DE CONTROL': '{desc1}', 'DWYER-DCT1022-DCP200A': '{desc2}',
            'CLP.+': '{a1}', 'CLP.-': '{a2}', 'SHIELD.1': '{a3}', 'XF5.6B': '{a4}', 'XF5.6A': '{a5}', 'CB14.2': '{a6}', 'CB14.4': '{a7}', 'PE8': '{a8}',
            'TMX': '{tmx}', 're:^[A-Z]{3}\\.[A-Z]{3}-[A-Z]{2}-\\d{3}-': '{tmxm}'}),
        'l_tb': dict(rects=[R(22, 130, 344, 172, 380)], ancla=A(22, 178), textos={'TB1': '{tb}', '4mm2': '{tbs}', 'PTTB4': '{tbm}', 'UT4-PE': '{tbpe}', 'CAJA DE PASO': '{caja}'}),
        'l_borne': dict(rects=[R(22, 175, 359, 190, 369)], ancla=A(22, 178), textos={'PE': '{b}'}),
        'l_valv': dict(rects=[R(22, 52, 190, 90, 230)], ancla=A(22, 72), textos={'re:-XV-': '{tag}'}),
    },
}
