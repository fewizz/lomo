struct ufp24 { uint value; };
struct ufp22 { uint value; };
struct fp24  { int  value; };
struct fp22  { int  value; };

struct ufp24vec2 { ufp24 x; ufp24 y; };
struct ufp22vec2 { ufp22 x; ufp22 y; };
struct fp22vec2  { fp22  x; fp22  y; };

ufp24 zero_ufp24() { return ufp24(0u); }
ufp22 zero_ufp22() { return ufp22(0u); }

ufp24vec2 zero_ufp24vec2() { return ufp24vec2( zero_ufp24(), zero_ufp24 () ); }
ufp22vec2 zero_ufp22vec2() { return ufp22vec2( zero_ufp22(), zero_ufp22() ); }

fp22 negate(fp22 v) { return fp22(-v.value); }

uint  inner_as_uint(ufp24  v) { return v.value & ((1u << 8u ) - 1u); }
uint  inner_as_uint(ufp22  v) { return v.value & ((1u << 10u) - 1u); }
float inner_as_float(ufp24 v) { return float(v.value & ((1u << 8u) - 1u)) / float(1u << 8u); }

vec2  inner_as_vec2 (ufp24vec2 v) { return vec2 (inner_as_float(v.x), inner_as_float(v.y)); }
uvec2 inner_as_uvec2(ufp24vec2 v) { return uvec2(inner_as_uint (v.x), inner_as_uint (v.y)); }

uint  outer_as_uint(ufp24 v) { return v.value >> 8u; }

uvec2 outer_as_uvec2(ufp24vec2 v) { return uvec2( outer_as_uint(v.x), outer_as_uint(v.y)); }

float ufp24_as_float (ufp24 v) { return float( outer_as_uint(v) ) + inner_as_float(v); }

vec2  ufp24vec2_as_vec2 (ufp24vec2 v) { return vec2 (outer_as_uvec2(v)) + inner_as_vec2(v); }
uvec2 ufp24vec2_as_uvec2(ufp24vec2 v) { return uvec2(v.x.value, v.y.value); }

ufp24 div(ufp24 x, ufp24 y) { return ufp24((x.value << 8u ) / y.value); }
ufp24 div(ufp24 x, ufp22 y) { return ufp24((x.value << 10u) / y.value); }

ufp24 mul(ufp24 x, ufp22 y) { return ufp24((x.value * y.value) >> 10u); }

ufp24 add(ufp24 x, ufp24 y) { return ufp24(x.value + y.value); }
ufp24 add(ufp24 x,  fp24 y) { return ufp24(uint(int(x.value) + y.value)); }
ufp24 sub(ufp24 x, ufp24 y) { return ufp24(x.value - y.value); }

ufp24 ufp24_from_float(float v) { return ufp24(uint(v * float(1u << 8u ))); }
ufp22 ufp22_from_float(float v) { return ufp22(uint(v * float(1u << 10u))); }
 fp22  fp22_from_float(float v) { return  fp22( int(v * float(1u << 10u))); }

ufp24vec2 ufp24vec2_from_vec2(vec2 v) { return ufp24vec2(ufp24_from_float(v.x), ufp24_from_float(v.y)); }
ufp22vec2 ufp22vec2_from_vec2(vec2 v) { return ufp22vec2(ufp22_from_float(v.x), ufp22_from_float(v.y)); }
 fp22vec2  fp22vec2_from_vec2(vec2 v) { return  fp22vec2( fp22_from_float(v.x),  fp22_from_float(v.y)); }
ufp24vec2 ufp24vec2_from_uvec2(uvec2 v) { return ufp24vec2(ufp24(v.x), ufp24 (v.y)); }
ufp22vec2 ufp22vec2_from_uvec2(uvec2 v) { return ufp22vec2(ufp22(v.x), ufp22(v.y)); }

ufp24vec2 div(ufp24vec2 x, ufp24vec2 y) { return ufp24vec2( div(x.x, y.x), div(x.y, y.y) ); }
ufp24vec2 div(ufp24vec2 x, ufp22vec2 y) { return ufp24vec2( div(x.x, y.x), div(x.y, y.y) ); }
ufp24vec2 add(ufp24vec2 x, ufp24vec2 y) { return ufp24vec2( add(x.x, y.x), add(x.y, y.y) ); }
ufp24vec2 add(ufp24vec2 x, uvec2 y) { return add( x, ufp24vec2_from_uvec2(y) ); }
ufp24vec2 add(ufp24vec2 x, ivec2 y) {
	return ufp24vec2(
		ufp24( uint(int(x.x.value) + y.x) ),
		ufp24( uint(int(x.y.value) + y.y) )
	);
}
ufp24vec2 add(ufp24vec2 x, vec2 y) { return add(x, ivec2(y * float(1u << 8u))); }

ufp24 clean_inner(ufp24 v) { return ufp24( outer_as_uint(v) << 8u ); }
ufp24vec2 clean_inner(ufp24vec2 v) { return ufp24vec2( clean_inner(v.x), clean_inner(v.y) ); }
