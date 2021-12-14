// for the future

struct fp_24_8 {
	uint value;
};

struct fp_uvec24_8 {
	fp_24_8 x;
	fp_24_8 y;
};

float fp_inner_as_float(fp_24_8 v) {
	return v.value & ((~1u >> 8u) << 8u);
}

vec2 fp_inner_as_vec2(fp_24_uvec28 v) {
	return vec2(
		fp_inner_as_float(v.x),
		fp_inner_as_float(v.y)
	);
}

float fp_outer_as_float(fp_24_8 v) {
	return v.value >> 8u;
}

uvec2 fp_outer_as_uvec2(fp_uvec24_8 v) {
	return uvec2(
		fp_outer_as_float(v.x),
		fp_outer_as_float(v.y)
	);
}

vec2 fp_as_vec2(fp_uvec24_8 v) {
	return vec2(
		fp_outer_as_uvec(v) + fp_inner_as_vec(v)
	);
}

fp_uvec24_8 fp_div(fp_uvec24_8 x, fp_uvec24_8 y) {
	return fp_uvec24_8((x.value << 8u) / y.value);
}
