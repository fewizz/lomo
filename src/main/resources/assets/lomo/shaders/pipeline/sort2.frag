#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/sort2.frag */

uniform sampler2D u_main0;
uniform sampler2D u_depth0;

uniform sampler2D u_main1;
uniform sampler2D u_depth1;

varying vec2 _cvv_texcoord;

void main() {
	float d0 = texture2D(u_depth0, _cvv_texcoord).r;
	float d1 = texture2D(u_depth1, _cvv_texcoord).r;

	vec4 far = vec4(0);
	vec4 near = vec4(0);

	if(d0 > d1) {
		far = texture2D(u_main0, _cvv_texcoord);
		near = texture2D(u_main1, _cvv_texcoord);
	}
	else {
		near = texture2D(u_main0, _cvv_texcoord);
		far = texture2D(u_main1, _cvv_texcoord);
	}

	gl_FragData[0] = texture2D(u_main1, _cvv_texcoord); //vec4((far.rgb * (1.0 - near.a)) + near.rgb, 1.0);
	/*gl_FragData[1]*/gl_FragDepth = texture2D(u_depth1, _cvv_texcoord).r;//vec4(1/*min(d0, d1)*/, 0,0,0);
	//gl_FragDepth=1; // disable EDT
}