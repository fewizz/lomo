#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl

uniform sampler2D u_main;
uniform sampler2D u_depth;

float sqrt_0_5 = sqrt(0.5);

/*(float linearalize(float val) {
	return val*val;
}*/
out vec4 out_color;

float focus(float center_depth, ivec2 coord, mat4 proj) {
	float depth = texelFetch(u_depth, coord, 0).r;
	depth = linearalize_z_win(depth, proj);

	float res = 0;
	// not sure
	if(depth <= center_depth)
		res = (center_depth - depth) / center_depth;
	else
		res = (depth - center_depth) / (1 - center_depth);

	return res;
}

void main() {
	mat4 proj = frx_projectionMatrix();

	float center_depth_ws = texelFetch(u_depth, textureSize(u_depth, 0) / 2, 0).r;

	float linear_center_depth = linearalize_z_win(center_depth_ws, proj);

	vec4 resulting_color = vec4(0);
	float resulting_mul = 0;

	for(int x = -1; x <= 1; ++x) {
		for(int y = -1; y <= 1; ++y) {
			ivec2 coord = ivec2(gl_FragCoord.xy) + ivec2(x, y);

			vec4 color = texelFetch(u_main, coord, 0);

			if(x == 0 && y == 0) {
				resulting_color += color;
				resulting_mul += 1;
			}
			else {
				float dist = x*y != 0 ? sqrt_0_5 : 1;
			
				float mul = dist * focus(linear_center_depth, coord, proj);
				resulting_color += color * mul;
				resulting_mul += mul;
			}
		}
	}
	
	out_color = resulting_color / resulting_mul;
}