#include frex:shaders/api/header.glsl

/* lomo:pipeline/copy_to_array.frag */

// uniform sampler array, please?
uniform sampler2D u_i0;
uniform sampler2D u_i1;
uniform sampler2D u_i2;
uniform sampler2D u_i3;
uniform sampler2D u_i4;
uniform sampler2D u_i5;

uniform sampler2D u_index_to_type;

layout(location = 0) out vec4 out_values[6];

void main() {
	ivec2 coord = ivec2(gl_FragCoord.xy);

	vec4 values[6] = vec4[] (
		texelFetch(u_i0, coord, 0),
		texelFetch(u_i1, coord, 0),
		texelFetch(u_i2, coord, 0),
		texelFetch(u_i3, coord, 0),
		texelFetch(u_i4, coord, 0),
		texelFetch(u_i5, coord, 0)
	);

	uint index_to_type = floatBitsToUint(texelFetch(u_index_to_type, coord, 0).r);

	for(uint i = 0u; i < 6u; i++) {
		uint index = (index_to_type >> (4u*i)) & 0xFu;
		out_values[i] = values[index];
	}
}