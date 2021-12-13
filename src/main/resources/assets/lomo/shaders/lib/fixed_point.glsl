// for the future

struct fp_24_8 {
	uint value;
};

struct fp_uvec24_8 {
	uvec2 value;
};

vec2 fp_inner_as_vec(fp_uvec24_8 v) {
	return v.value & ((~1u >> 8u) << 8u);
}

uvec2 fp_outer_as_uvec(fp_uvec24_8 v) {
	return v.value >> 8u;
}

vec2 fp_as_vec(fp_uvec24_8 v) {
	return vec2(fp_outer_as_uvec(v)) + fp_inner_as_vec(v);
}

fp_uvec24_8 fp_div(fp_uvec24_8 x, fp_uvec24_8 y) {
	return fp_uvec24_8((x.value << 8u) / y.value);
}
