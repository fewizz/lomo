struct fp24_8 { uint value; };
struct fp22_10 { uint value; };

struct uvec2_fp24_8 { fp24_8 x; fp24_8 y; };
struct uvec2_fp22_10 { fp22_10 x; fp22_10 y; };

fp24_8 zero_fp24_8() { return fp24_8(0u); }
fp22_10 zero_fp22_10() { return fp22_10(0u); }

uvec2_fp24_8 zero_uvec2_fp24_8() { return uvec2_fp24_8( zero_fp24_8(), zero_fp24_8() ); }
uvec2_fp22_10 zero_uvec2_fp22_10() { return uvec2_fp22_10( zero_fp22_10(), zero_fp22_10() ); }

uint inner_as_uint(fp24_8 v) { return v.value & ((1u << 8u) - 1u); }
uint inner_as_uint(fp22_10 v) { return v.value & ((1u << 10u) - 1u); }
float inner_as_float(fp24_8 v) { return float(v.value & ((1u << 8u) - 1u)) / float(1u << 8u); }
vec2  inner_as_vec2(uvec2_fp24_8 v) { return vec2(inner_as_float(v.x), inner_as_float(v.y)); }
uvec2 inner_as_uvec2(uvec2_fp24_8 v) { return uvec2(inner_as_uint(v.x), inner_as_uint(v.y)); }

uint outer_as_uint(fp24_8 v) { return v.value >> 8u; }
uvec2 outer_as_uvec2(uvec2_fp24_8 v) { return uvec2( outer_as_uint(v.x), outer_as_uint(v.y)); }

vec2 fp_as_vec2(uvec2_fp24_8 v) { return vec2(outer_as_uvec2(v) + inner_as_vec2(v)); }

fp24_8 div(fp24_8 x, fp24_8 y) { return fp24_8((x.value << 8u) / y.value); }
fp24_8 div(fp24_8 x, fp22_10 y) { return fp24_8((x.value << 10u) / y.value); }
fp24_8 add(fp24_8 x, fp24_8 y) { return fp24_8(x.value + y.value); }

fp24_8 fp24_8_from_float(float v) { return fp24_8((uint(v) << 8u) + uint(fract(v) * float(1u << 8u))); }
fp22_10 fp22_10_from_float(float v) { return fp22_10((uint(v) << 10u) + uint(fract(v) * float(1u << 10u))); }

uvec2_fp24_8 uvec2_fp24_8_from_vec2(vec2 v) { return uvec2_fp24_8(fp24_8_from_float(v.x), fp24_8_from_float(v.y)); }
uvec2_fp24_8 uvec2_fp24_8_from_uvec(uvec2 v) { return uvec2_fp24_8(fp24_8(v.x), fp24_8(v.y)); }
uvec2_fp22_10 uvec2_fp22_10_from_vec2(vec2 v) { return uvec2_fp22_10(fp22_10_from_float(v.x), fp22_10_from_float(v.y)); }

uvec2_fp24_8 div(uvec2_fp24_8 x, uvec2_fp24_8 y) { return uvec2_fp24_8( div(x.x, y.x), div(x.y, y.y) ); }
uvec2_fp24_8 div(uvec2_fp24_8 x, uvec2_fp22_10 y) { return uvec2_fp24_8( div(x.x, y.x), div(x.y, y.y) ); }
uvec2_fp24_8 add(uvec2_fp24_8 x, uvec2_fp24_8 y) { return uvec2_fp24_8( add(x.x, y.x), add(x.y, y.y) ); }
uvec2_fp24_8 add(uvec2_fp24_8 x, uvec2 y) { return add( x, uvec2_fp24_8_from_uvec(y) ); }
uvec2_fp24_8 add(uvec2_fp24_8 x, ivec2 y) {
	return uvec2_fp24_8(
		fp24_8( uint(int(x.x.value) + y.x) ),
		fp24_8( uint(int(x.y.value) + y.y) )
	);
}
uvec2_fp24_8 add(uvec2_fp24_8 x, vec2 y) { return add(x, ivec2(y * float(1 << 8))); }

fp24_8 clean_inner(fp24_8 v) { return fp24_8( outer_as_uint(v) << 8u ); }
uvec2_fp24_8 clean_inner(uvec2_fp24_8 v) { return uvec2_fp24_8( clean_inner(v.x), clean_inner(v.y) ); }
