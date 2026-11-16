"""Piezas del DIAGRAMA DE LAZO (plantilla de lazos del usuario, 2 hojas de 806 x 533 mm en el espacio modelo).
Columnas CAMPO | TABLERO DE CONTROL | SOFTWARE con banda de encabezado; una fila por lazo. Las coordenadas de la
plantilla están en el espacio modelo; cada pieza se guarda relativa a su ancla:
· x relativa al origen del área de dibujo de su hoja (X1 hoja 1, X2 hoja 2), de modo que el generador conserva
  las columnas de la plantilla (equipo de campo x≈44…72, bornes del tablero x≈349…364, relé x≈503…518, módulo
  x≈596…626, CPU x≈626…651, software x≈651…760);
· y relativa a la línea del conductor (o al centro del borne / casillero) que la pieza recibe, para que el
  generador apile las filas con la altura que realmente ocupa cada lazo.
Las filas se arman en js/cad/plano-lazo.js con estas piezas: equipo de campo por tipo (transmisor de 2 hilos,
interruptor con alimentación propia DI + PWR, sensor PNP o contacto seco, equipo de 4 hilos AI + PWR), casillero
de bornera con su cabecera, referencias de tensión (24 Vdc, 120 Vac, N, PE, 0 Vdc), relé de interfaz, módulo de
E/S (analógico con IN+/IN-/Shield o discreto con un borne), barra de la CPU, símbolo de software con su flecha,
encabezado de columnas y leyenda de conexión. Los cables (haces con sus curvas), la pantalla y las líneas hacia el
módulo los dibuja el generador con las capas de la plantilla.
Los bloques dinámicos de la plantilla traen casilleros y atributos ocultos (estado de visibilidad): se excluyen con
el rectángulo de la pieza o con «omitir». Los TAG, códigos y servicios del proyecto de referencia se reemplazan por
marcadores {clave} (claves «re:» para reconocerlos sin escribir los códigos)."""

X1, X2, Y = 142450.6, 143333.7, 8882.5          # origen del área de dibujo de las hojas 1 y 2 de la plantilla
F1, F3 = 9358.0, 9258.0                          # hoja 1: conductor superior de la fila 1 (transmisor) y fila 3 (nivel)
F2P, F2A = 9313.0, 9203.0                        # hoja 2: fila del sensor PNP con relé y fila del equipo de 4 hilos


def R(x, y, x0, y0, x1, y1):
    """rectángulo relativo a (x, y)"""
    return (x + x0, y + y0, x + x1, y + y1)


TAG = 're:^[A-Z]{2,5}-\\d+[A-Z]?$'               # TAG corto de la plantilla (burbuja de campo o de software)
SIS = 're:^\\d{3,5}[A-Z]{2,4}\\d{3}$'            # código del sistema del proyecto de referencia

PIEZAS_KIT = {
    'fuente': 'Diagrama de lazo (plantilla de lazos del usuario)',
    'piezas': {
        # ---------------- lámina: encabezado de columnas y leyenda ----------------
        'encabezado': dict(rects=[R(X1, Y, -1, 511.5, 807, 534)], ancla=(X1, Y), textos={
            're:^CAMPO\\b': 'CAMPO - {sis}', 're:^TABLERO DE CONTROL\\b': 'TABLERO DE CONTROL\n{tc}'}),
        'leyenda': dict(rects=[R(X1, Y, 327, 10.5, 425.5, 69.5)], ancla=(X1, Y), textos={
            're:^L.nea de fuerza 120': 'Línea de fuerza {vac}', 're:^L.nea de fuerza 24': 'Línea de fuerza 24 Vdc'}),
        # rótulo de la CPU sobre su barra (la barra la dibuja el generador con la altura de la lámina)
        'cpu': dict(rects=[R(X1, Y, 626, 497, 652.2, 505)], ancla=(X1, Y), textos={'re:^\\S+$': '{cpu}'}),

        # ---------------- módulos de E/S (ancla: centro del primer casillero de bornes) ----------------
        'mod_ai': dict(rects=[R(X1, F1 - 4.99, 596, -12.6, 627, 22.9)], ancla=(X1, F1 - 4.99), textos={
            're:^TIPO:': '{tipo}', '01': '{v}', '00': '{v}', 'IN0+': '{i1}', 'IN0-': '{i2}', 'Shield': '{i3}'}),
        'mod_di': dict(rects=[R(X1, F3 - 14.99, 596, -2.6, 627, 22.9)], ancla=(X1, F3 - 14.99), textos={
            're:^TIPO:': '{tipo}', '01': '{v}', '06': '{v}', '00': '{v}', 'IN-0': '{i1}'}),

        # ---------------- software (ancla: flecha que sale de la CPU) ----------------
        'sw': dict(rects=[R(X1, F1 - 2.49, 650.5, -9.5, 762, 21)], ancla=(X1, F1 - 2.49), textos={
            're:^PRESI': '{serv}', TAG: '{fn}', SIS: '{sis}', 'H': '', 'L': ''}),

        # ---------------- equipos de campo (ancla: centro del primer casillero de bornes) ----------------
        # transmisor de 2 hilos (+, -, GND); también válvula solenoide o posicionador
        'd_tx': dict(rects=[R(X1, F1, 40, -27, 67.2, 3)], ancla=(X1, F1), omitir=[R(X1, F1, 56.2, -27.8, 66.8, -12.4)], textos={
            TAG: '{tag}', SIS: '{sis}', 're:^TRANSMISOR': '{desc}', '+': '{d1}', '-': '{d2}', 'GND': '{d3}'}),
        # interruptor con alimentación propia: DI (NO, COM, NC) + PWR (N, L, GND)
        'd_di': dict(rects=[R(X1, F3, 40, -42, 76, 3)], ancla=(X1, F3), textos={
            TAG: '{tag}', SIS: '{sis}', 're:^INTERRUPTOR': '{desc}',
            '5/NO': '{d1}', '4/COM': '{d2}', '3/NC': '{d3}', '2/N': '{d4}', '1/L': '{d5}', 'GND': '{d6}'}),
        # sensor PNP de 24 Vdc (BN, BK, BU) o contacto seco de 3 bornes; rótulo lateral variable
        'd_pnp': dict(rects=[R(X2, F2P, 40, -27, 76, 3)], ancla=(X2, F2P), omitir=[R(X2, F2P, 61.2, -27.8, 71.8, -12.4)], textos={
            TAG: '{tag}', SIS: '{sis}', 're:^INTERRUPTOR': '{desc}', 'BN': '{d1}', 'BK': '{d2}', 'BU': '{d3}', 'PNP': '{lado}'}),
        # equipo de 4 hilos: AI (+, -) + PWR (L, N, GND)
        'd_4h': dict(rects=[R(X2, F2A, 40, -36, 76, 3)], ancla=(X2, F2A), omitir=[R(X2, F2A, 61.2, -27.8, 71.8, -22.4)], textos={
            TAG: '{tag}', SIS: '{sis}', 're:^SENSOR': '{desc}', '+': '{d1}', '-': '{d2}', 'L': '{d3}', 'N': '{d4}', 'GND': '{d5}'}),

        # ---------------- bornera del tablero (ancla: borde izquierdo del casillero, en su centro) ----------------
        'b_cab': dict(rects=[R(X1 + 351.47, F1, -2.8, 2.2, 12.8, 7.9)], ancla=(X1 + 351.47, F1), textos={'re:^XF\\d$': '{tb}'}),
        'b_borne': dict(rects=[R(X1 + 351.47, F1, -0.3, -2.7, 10.3, 2.7)], ancla=(X1 + 351.47, F1), textos={'re:^\\d[A-Z]$': '{b}'}),
        # relé de interfaz (ancla: centro del borne 14, borde izquierdo de la columna de relés)
        'rele': dict(rects=[R(X2, F2P, 502.5, -12.7, 519, 12.8)], ancla=(X2, F2P), textos={'re:^CR\\d+$': '{tag}'}),

        # ---------------- referencias de tensión (ancla: borde del casillero en la línea) ----------------
        's_ana': dict(rects=[R(X1 + 361.47, F1, -0.2, -1.2, 20, 4)], ancla=(X1 + 361.47, F1), textos={'re:VDC$': '{v}'}),
        's_dc': dict(rects=[R(X2 + 361.46, F2P + 0.01, -0.2, -1.2, 20, 4)], ancla=(X2 + 361.46, F2P + 0.01), textos={'re:VDC$': '{v}'}),
        's_ac': dict(rects=[R(X2 + 361.46, F2A - 39.99, -0.2, -1.2, 20, 4)], ancla=(X2 + 361.46, F2A - 39.99), textos={'re:VAC$': '{v}'}),
        's_ctl': dict(rects=[R(X1 + 361.47, F3 - 19.99, -0.2, -1.2, 20, 4)], ancla=(X1 + 361.47, F3 - 19.99), textos={'re:VAC$': '{v}'}),
        's_pe': dict(rects=[R(X1 + 361.47, F3 - 9.99, -0.2, -1.2, 12, 4)], ancla=(X1 + 361.47, F3 - 9.99), textos={'PE': '{v}'}),
        # referencia a la izquierda de un casillero (0 Vdc junto al borne IN- del módulo en la plantilla)
        's_izq': dict(rects=[R(X1 + 596.47, F1 - 9.99, -16, -1.2, 0.3, 4)], ancla=(X1 + 596.47, F1 - 9.99), textos={'re:VDC$': '{v}'}),
    },
}
