#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/sort.frag */

uniform sampler2D u_d0;
uniform sampler2D u_d1;
uniform sampler2D u_d2;
uniform sampler2D u_d3;
uniform sampler2D u_d4;
uniform sampler2D u_d5;

layout(location = 0) out vec4 out_indices;

void main() {
	ivec2 coord = ivec2(gl_FragCoord.xy);

	int indices[6];
	float depths[6] = float[](
		texelFetch(u_d0, coord, 0).r,
		texelFetch(u_d1, coord, 0).r,
		texelFetch(u_d2, coord, 0).r,
		texelFetch(u_d3, coord, 0).r,
		texelFetch(u_d4, coord, 0).r,
		texelFetch(u_d5, coord, 0).r
	);

	//for(int i = 0; i < 6; i++) depths[i] = texelFetch(u_depths[i], coord, 0).r;

	float prev_min = -1;

	for(int i = 0; i < 6; i++) {
		float current_min = 1;
		int current_index = 0;

		for(int x = 0; x < 6; x++) {
			float d = depths[x];

			if(d < current_min && d > prev_min) {
				current_min = d;
				current_index = x;
			}

			indices[i] = current_index;
			prev_min = current_min;
		}
	}

	int result = 0;
	for(int i = 0; i < 6; i++) {
		//result |= indices[i] << (i*4);
		if(indices[i] == 0) result = i;
	}

	out_indices = vec4(indices[0] / 5.0, 0., 0., 0.);
}