"""Piezas de los planos de referencia (coordenadas del espacio modelo de cada plantilla, en mm).
Cada pieza: rectángulos que la contienen (se toma toda primitiva que cae completa dentro de alguno), punto
de anclaje (las coordenadas se guardan relativas a él) y los textos variables → marcadores {clave}.
El orden importa: una primitiva se asigna a la primera pieza que la contiene."""

BUS_Y = 517.4   # barra principal del unifilar de referencia

UNIFILAR = {
    'fuente': 'Diagrama unifilar del tablero de fuerza (referencia del usuario)',
    'piezas': {
        # accesorios de la acometida (antes que la acometida para quedarse con sus derivaciones)
        'acc_rf': dict(rects=[(321, 525, 446, 562.95)], ancla=(325, BUS_Y), textos={
            'F4,F5,F6': '{f}', '1X2A': '{fv}', 'E91/32': '{fm}', '3C#14AWG+14AWG(T) 0.6/1kV': '{cable}', 'RF': '{dev}', 'CM-MPS.41S': '{mod}'}),
        'acc_lt': dict(rects=[(321, 598, 470, 633)], ancla=(325, BUS_Y), textos={
            'F1,F2,F3': '{f}', '1X4A': '{fv}', 'E91/32': '{fm}', '3C#14AWG+14AWG(N) 0.6/1kV': '{cable}', 'LT1,LT2,LT3': '{dev}', '40-600VAC': '{rango}'}),
        'acc_spd': dict(rects=[(321, 545, 545, 588)], ancla=(325, BUS_Y), textos={
            '-FS1': '{f}', '3x125A': '{fv}', '3C#10AWG+10AWG(T) 0.6/1kV': '{cable}', 'SPD1,SPD2,SPD3': '{dev}', 'TIPO 1 y 2': '{tipo}', 'OVR T1 T2 3L 12.5-440 P QS': '{mod}'}),
        'retorno': dict(rects=[(450, 335, 600, 615)], ancla=(325, BUS_Y), capas=['E-TIERRA']),
        'acometida': dict(rects=[(285, 580, 365, 705), (300, 515, 340, 600)], ancla=(325, BUS_Y), centrar=dict(cajas=[(292.08, 669.79, 356.26, 687.93)]), textos={
            'VIENE DEL TABLERO CENTRO CONTROL DE MOTORES BT Nª 112-MCL-001 CIRCUITO 112DCB011-P01': '{acometida}',
            'MCB1': '{q}', '3x250A': '{qv}', '3xB.Cu 20x5 mm + 1xB.Cu 20x3 mm(T)': '{barra}'}),
        'titulo': dict(rects=[(5, 615, 130, 640)], ancla=(10.8, 631.8), centrar=dict(cajas=[(10.8, 620.97, 120.88, 631.8)]), textos={
            'TABLERO DE FUERZA 112DCP011-DPA-001 460 VAC, 3F+T, 60Hz': '{tit1}\n{tit2}'}),
        'pimd': dict(rects=[(595, 618, 640, 636)], ancla=(637.8, 631.8), centrar=dict(cajas=[(600.64, 620.97, 637.8, 631.8)]), textos={'PI: 150.2 kVA MD: 149.45 kVA': '{pi}\n{md}'}),
        'barra_txt': dict(rects=[(55, 519, 300, 527)], ancla=(71.8, BUS_Y), textos={
            'R,S,T 460 VAC, 3F, 60Hz, 65 KA': '{barra1}', '3xB.Cu 20x5 mm + 1xB.Cu 20x3 mm(T)': '{barra2}'}),
        'tierra': dict(rects=[(5, 286, 45, 345)], ancla=(20.8, 339.3)),
        'leyenda': dict(rects=[(645, 370, 805, 640)], ancla=(656.5, 631.8), centrar=dict(celdas=True), textos={'POSO A TIERRA': 'POZO A TIERRA', '(NOTA 3)': ''}),
        # columnas (ancla: eje del circuito sobre la barra principal)
        'col_vfd': dict(rects=[(38, 195, 101, 519.5)], ancla=(71.8, BUS_Y), textos={
            'C1': '{circ}', 'MCB2': '{q}', '3x250A': '{qv}', '-FS2': '{f}', '3X400A': '{fv}', 'RL1': '{rl}', '208A': '{rlv}',
            '-VFD1': '{vfd}', 'VFD': '{vfdtxt}', '186A': '{vfdv}', '1-3C#4/0AWG+3/0AWG(T) 0.6/1kV': '{cable}',
            'M1': '{m}', '150HP': '{hp}', '183.6A': '{amp}', 'VENTILADOR CENTRIFUGO 112-DCB-011B': ''}),
        'col_mcp': dict(rects=[(101, 195, 159, 519.5)], ancla=(130.1, BUS_Y), textos={
            'C2': '{circ}', 'MCP1': '{q}', '1.00-1.60 A': '{qv}', 'M1': '{k}', 'AF09-30-10-13': '{km}', '9A': '{kv}',
            '1-3C#12AWG+12AWG(T) 0.6/1kV': '{cable}', 'M2': '{m}', '1HP': '{hp}', '1.22': '{amp}',
            'VALVULA ROTATIVA 112-DCB-011M1': ''}),
        # grupo de transformador: cabecera + derivaciones del secundario
        'trafo': dict(rects=[(385, 416, 445, 519.5)], ancla=(400.1, BUS_Y), textos={
            'C5': '{circ}', 'F7,F8': '{f}', '1X6A': '{fv}', 'E91/32': '{fm}', 'T1': '{t}', '2kVA': '{tv}', '460/220VAC+T': '{tm}',
            'QG2': '{q}', '2X20A': '{qv}'}),
        'trafo_txt': dict(rects=[(290, 418, 382, 426)], ancla=(310.1, 415.3), textos={'R,S 220 VAC, 1F, 60Hz, 10 KA': '{sb}'}),
        'rama': dict(rects=[(335, 210, 377, 417.5)], ancla=(355.1, 415.3), textos={
            'C2': '{circ}', 'CB2': '{q}', '2X6A': '{qv}', '2C#16AWG+16AWG(T) 0.6/1kV': '{cable}', 'VENTILADORES': ''}),
        'rama_id': dict(rects=[(425, 210, 472, 417.5)], ancla=(445.1, 415.3), textos={
            'C4': '{circ}', 'CB4': '{q}', '2X4A': '{qv}', 'ID1': '{id}', '2A': '{idv}', '30mA': '{idm}',
            '2C#16AWG+16AWG(T) 0.6/1kV': '{cable}', 'TOMACORRIENTE': ''}),
    },
}

PIEZAS = {'unifilar': UNIFILAR}

# ---------------------------------------------------------------------------------------------------------
# MULTIFILAR: hojas del espacio modelo cada 975.162 mm (hoja 1 acometida, hoja 2 fuerza, hoja 3 secundarios).
# Las columnas se separan por el centro de cada primitiva (etiquetas y cajas se intercalan entre columnas).
H = 975.162
B1, B2, B3, BPE = 664.51, 648.51, 632.51, 616.51
FILTRO_REF = None   # las referencias cruzadas a hojas de control se filtran en el generador

MULTIFILAR = {
    'fuente': 'Diagrama multifilar del tablero de fuerza (referencia del usuario)',
    'piezas': {
        'h_acometida': dict(rects=[(-1, 158, 807, 681)], ancla=(0, 0), centrar=dict(celdas=True, zona=(0, 155, 140, 195)), textos={
            'VIENE DEL TABLERO CENTRO CONTROL DE MOTORES BT N° 112-MCL-001 CIRCUITO 112DCB011-P01': '{acometida}',
            'Alimentación 460 V 60 Hz 3F +PE': '{alim}',
            'MCB1': '{q}', '250A': '{qv}', 'XT4H 250 Ekip LS/I In=250A 3p F F': '{qm}',
            '460/120VAC+T': '{t1}', '460V': '{vp}', '120V': '{vs}', '/9.A:1': '', '/9.F:1': '',
            'NOTAS : 1.LA ACOMETIDA PARA EL TABLERO DE FUERZA 112DCB011-DPA-001 DE 460 VAC, 3F + T, 60 HZ ES SUMINISTRADA POR EL CLIENTE. 2.BARRA A TIERRA FIJA DEL TABLERO DE FUERZA Y CONTROL. 3.LOS EQUIPOS ELÉCTRICOS Y DE PROTECCIÓN, ESTÁN DISEÑADOS Y FABRICADOS PARA TRABAJAR A 1000 m.s.n.m.': '{notas}'}),
        # hoja 2: entrada y salida de barras, columnas
        'b_entrada': dict(rects=[(H, 598, H + 120, 681)], ancla=(H, 0), centro=True, barras_y=[B1, B2, B3, BPE]),
        'b_salida': dict(rects=[(H + 737, 598, H + 812, 681)], ancla=(H + 737, 0), centro=True, barras_y=[B1, B2, B3, BPE]),
        'b_vfd': dict(rects=[(H + 55, 160, H + 275, 677), (H + 275, 265, H + 300, 345), (H + 10, 160, H + 55, 596)], ancla=(H + 55, 0), centro=True, max_ancho=260, barras_y=[B1, B2, B3, BPE], textos={
            'CB2': '{q}', '250A': '{qv}', 'XT4S 250 Ekip LS/I': '{qm}', 'In=250A 3p F F': '', 'FS2': '{f}', '315A': '{fv}', 'XLP1-6CC': '{fm}', '170M3817D': '',
            'RL1': '{rl}', 'MAPA0208D': '{rlm}', '208A': '{rlv}', 'VFD1': '{vfd}', '20F1AND186JA0NNNNN': '{vfdm}', '186A': '{vfdv}', 'PF753': '{vfdtxt}',
            '-MT1': '{m}', '150 HP': '{hp}', '460 VAC': '{v}', '170 A': '{amp}', '112-DCB-011B': '{tag}', 'VENTILADOR': '{desc1}', 'CENTRÍFUGO': '{desc2}'}),
        'b_mcp': dict(rects=[(H + 275, 345, H + 365, 677), (H + 275, 160, H + 365, 265), (H + 300, 265, H + 365, 345)], ancla=(H + 275, 0), centro=True, max_ancho=120, barras_y=[B1, B2, B3, BPE], textos={
            'MCP1': '{q}', '1.6...2.5A': '{qv}', 'MS132-2.5': '{qm}', 'M1': '{k}', '9A': '{kv}', 'AF09-30-10-13': '{km}', 'HKF1-11+HK1-11': '{aux}',
            'TB2': '{tb}', '6 mm2': '{tbs}', 'UT 6': '{tbm}', 'UT 6-PE': '{tbpe}',
            '-MT2': '{m}', '1 HP': '{hp}', '460 VAC': '{v}', '1.6 A': '{amp}', '112-DCB-011M1': '{tag}', 'VÁLVULA': '{desc1}', 'ROTATIVA': '{desc2}'}),
        'b_trafo': dict(rects=[(H + 552, 160, H + 652, 677)], ancla=(H + 545, 0), centro=True, max_ancho=120, barras_y=[B1, B2, B3, BPE], textos={
            'F9': '{f1}', 'F10': '{f2}', '6A': '{fv}', 'E91/32': '{fm}', 'T2': '{t}', '2kVA': '{tv}', '460/220VAC+T': '{tm}', '460V': '{vp}', '220V': '{vs}',
            'CB3': '{q}', '20A': '{qv}', 'S202-C20': '{qm}'}),
        # hoja 3: barras del secundario y derivaciones
        'c_entrada': dict(rects=[(2 * H, 598, 2 * H + 72, 681)], ancla=(2 * H, 0), centro=True, barras_y=[B1, B2, B3]),
        'c_rama': dict(rects=[(2 * H + 136, 160, 2 * H + 214, 668)], ancla=(2 * H + 130, 0), centro=True, max_ancho=90, barras_y=[B1, B2, B3], textos={
            'CB5': '{q}', '6A': '{qv}', 'S202-C6': '{qm}', 'ALIMENTACIÓN SISTEMA DE VENTILADOR TABLERO ELÉCTRICO': '{desc}'}),
        'c_rama_id': dict(rects=[(2 * H + 286, 160, 2 * H + 382, 668)], ancla=(2 * H + 286, 0), centro=True, max_ancho=96, barras_y=[B1, B2, B3], textos={
            'CB7': '{q}', '4A': '{qv}', 'S202-C4': '{qm}', '-ID1': '{id}', '30 mA': '{idm}', '25 A': '{idv}', 'FH202 AC': '{idmod}', '-25/0.03': '',
            'ALIMENTACIÓN TOMACORRIENTE TABLERO ELÉCTRICO': '{desc}'}),
    },
}
PIEZAS['multifilar'] = MULTIFILAR
